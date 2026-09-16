import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SubscriptionState } from "./billing-events";
import type { Plan, SubscriptionStatus } from "./entitlements";
import { PLANS, SUBSCRIPTION_STATUSES } from "./entitlements";
import type { OpnCharge } from "./opn/event";
import { BILLING_KINDS, type BillingKind } from "./plans";

/**
 * ที่เดียวที่โค้ดของเราแตะฐานข้อมูลด้วยสิทธิ์ service role
 *
 * ⚠️ service role ข้าม RLS ทั้งหมด ไฟล์นี้ต้องไม่ถูก import จากฝั่ง client เด็ดขาด
 * ด่านกันมีสองชั้น: ชื่อ env ไม่มี NEXT_PUBLIC_ นำหน้า Next จึงไม่ยัดค่าลง bundle
 * และ admin() พังทันทีถ้าถูกเรียกในเบราว์เซอร์
 */

export const GATEWAY = "opn";

let cached: SupabaseClient<Database> | null = null;

function admin(): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    throw new Error("store ของ billing ถูกเรียกจากฝั่ง client");
  }
  if (cached !== null) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url === undefined || key === undefined || key === "") {
    throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY");
  }

  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export type ClaimResult = "new" | "duplicate";

/**
 * จองสิทธิ์ประมวลผลเหตุการณ์นี้
 *
 * primary key ของ webhook_events เป็นคู่ (gateway, event_id) การ insert ครั้งที่สอง
 * จึงชนกุญแจแล้วคืน "duplicate" — นี่คือจุดเดียวที่กันการทำงานซ้ำ
 * ต้องเรียกก่อนแตะสิทธิ์ของผู้ใช้เสมอ
 */
export async function claimEvent(input: {
  eventId: string;
  eventKey: string;
  rawBody: string;
}): Promise<ClaimResult> {
  const { error } = await admin().from("webhook_events").insert({
    gateway: GATEWAY,
    event_id: input.eventId,
    event_key: input.eventKey,
    raw_body: input.rawBody,
  });

  if (error === null) return "new";
  // 23505 = unique_violation — เคยรับเหตุการณ์นี้ไปแล้ว
  if (error.code === "23505") return "duplicate";

  throw new Error(`บันทึก webhook_events ไม่สำเร็จ: ${error.message}`);
}

/** ปิดงานของเหตุการณ์ พร้อมบอกว่าทำอะไรไป — ใช้ไล่ย้อนตอนมีปัญหา */
export async function finishEvent(
  eventId: string,
  outcome: string,
): Promise<void> {
  const { error } = await admin()
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString(), outcome })
    .eq("gateway", GATEWAY)
    .eq("event_id", eventId);

  if (error !== null) {
    throw new Error(`ปิดงาน webhook ไม่สำเร็จ: ${error.message}`);
  }
}

function toPlan(value: string): Plan {
  return PLANS.includes(value as Plan) ? (value as Plan) : "free";
}

function toStatus(value: string): SubscriptionStatus {
  return SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus)
    ? (value as SubscriptionStatus)
    : "active";
}

function toBillingKind(value: string | null): BillingKind | null {
  return value !== null && BILLING_KINDS.includes(value as BillingKind)
    ? (value as BillingKind)
    : null;
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

export async function loadSubscription(
  ownerId: string,
): Promise<SubscriptionState | null> {
  const { data, error } = await admin()
    .from("subscriptions")
    .select("plan, billing_kind, status, current_period_end, grace_until")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`อ่าน subscription ไม่สำเร็จ: ${error.message}`);
  }
  if (data === null) return null;

  return {
    plan: toPlan(data.plan),
    billingKind: toBillingKind(data.billing_kind),
    status: toStatus(data.status),
    currentPeriodEnd: toDate(data.current_period_end),
    graceUntil: toDate(data.grace_until),
  };
}

/**
 * เขียนสถานะใหม่ คืน false ถ้ามีเหตุการณ์ที่ใหม่กว่าเขียนไปก่อนแล้ว
 *
 * การเทียบเวลาทำใน SQL ไม่ใช่ที่นี่ เพราะต้องอะตอมมิกกับการเขียน
 * ไม่งั้นเหตุการณ์สองอันที่มาพร้อมกันจะอ่านค่าเดิมเหมือนกันแล้วทับกันเอง
 */
export async function saveSubscription(
  ownerId: string,
  state: SubscriptionState,
  eventAt: Date,
): Promise<boolean> {
  const args = {
    p_owner_id: ownerId,
    p_event_at: eventAt.toISOString(),
    p_plan: state.plan,
    p_billing_kind: state.billingKind,
    p_status: state.status,
    p_current_period_end: state.currentPeriodEnd?.toISOString() ?? null,
    p_grace_until: state.graceUntil?.toISOString() ?? null,
  };

  // ตัวสร้าง types ของ Supabase ประกาศพารามิเตอร์ของ function เป็น non-null ทั้งหมด
  // ทั้งที่ฝั่ง Postgres รับ null ได้ปกติ (billing_kind ของคนที่ยังไม่เคยจ่ายคือ null)
  // cast ไว้จุดเดียวพร้อมเหตุผล ดีกว่าไปบิดสเปกของ function ให้ตรงกับตัวสร้าง types
  const { data, error } = await admin().rpc(
    "apply_billing_event",
    args as unknown as Database["public"]["Functions"]["apply_billing_event"]["Args"],
  );

  if (error !== null) {
    throw new Error(`เขียน subscription ไม่สำเร็จ: ${error.message}`);
  }

  return data === true;
}

/**
 * สถานะของ charge ที่ตาราง payments ยอมรับ
 *
 * Omise มีสถานะมากกว่าที่เราสนใจ (เช่น reversed / expired) และอาจเพิ่มอีกในอนาคต
 * ถ้าปล่อยผ่านตรง ๆ constraint จะเตะทิ้งแล้วทั้ง webhook พังทั้งที่แค่ชื่อสถานะไม่ตรง
 * จึงจับกลุ่มไว้ที่นี่ ของที่ไม่รู้จักถือว่ายังไม่จบ ให้คนไปดูของจริง
 */
function toPaymentStatus(status: string): string {
  switch (status) {
    case "successful":
    case "failed":
    case "pending":
      return status;
    case "reversed":
    case "refunded":
      return "refunded";
    default:
      return "pending";
  }
}

/** บันทึกรายการเงินไว้ทำบัญชีและออกใบเสร็จ — เขียนซ้ำได้ ไม่เกิดแถวซ้ำ */
export async function recordPayment(charge: OpnCharge): Promise<void> {
  const { error } = await admin()
    .from("payments")
    .upsert(
      {
        owner_id: charge.ownerId,
        gateway: GATEWAY,
        gateway_charge_id: charge.chargeId,
        price_code: charge.priceCode,
        amount_satang: charge.amountSatang,
        currency: charge.currency,
        status: toPaymentStatus(charge.status),
        paid_at: charge.paidAt?.toISOString() ?? null,
      },
      { onConflict: "gateway,gateway_charge_id" },
    );

  if (error !== null) {
    throw new Error(`บันทึก payment ไม่สำเร็จ: ${error.message}`);
  }
}

/**
 * เหตุการณ์ไหนในรายการนี้ที่เราเคยรับไว้แล้ว
 *
 * ใช้โดยงานกระทบยอด เพื่อหาว่ามีเหตุการณ์ไหนที่ Opn บอกว่ามี แต่เราไม่เคยได้รับ
 * — ซึ่งเกิดได้จริงเพราะ Omise ไม่ยิงซ้ำเมื่อส่งไม่สำเร็จ
 */
export async function findKnownEventIds(
  eventIds: string[],
): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();

  const { data, error } = await admin()
    .from("webhook_events")
    .select("event_id")
    .eq("gateway", GATEWAY)
    .in("event_id", eventIds);

  if (error !== null) {
    throw new Error(`อ่าน webhook_events ไม่สำเร็จ: ${error.message}`);
  }

  return new Set(data.map((row) => row.event_id));
}

/**
 * งานรายวันที่เดินตามลำดับเวลาใน docs/decisions/0008-downgrade-behaviour.md
 *
 * วันที่ 31 พัก QR ที่เกินโควตาฟรี · วันที่ 121 หยุดทำงานจริง
 * เรียกซ้ำได้โดยผลไม่เปลี่ยน cron พลาดแล้วรันชดเชยได้เลย
 */
export async function runDowngradeSweep(): Promise<{
  suspended: number;
  disabled: number;
}> {
  const { data, error } = await admin().rpc("run_downgrade_sweep");

  if (error !== null) {
    throw new Error(`run_downgrade_sweep ล้มเหลว: ${error.message}`);
  }

  const result = data as { suspended?: number; disabled?: number } | null;
  return {
    suspended: result?.suspended ?? 0,
    disabled: result?.disabled ?? 0,
  };
}

/**
 * คืนสภาพ QR ที่เราเป็นคนพัก
 *
 * ADR 0008 สัญญาไว้ว่า "กลับมาจ่ายเมื่อไรก็ใช้ต่อได้ทันที"
 * ถ้าลืมเรียกฟังก์ชันนี้ คนที่จ่ายเงินกลับมาแล้วจะยังเจอ QR ที่ป้ายหน้าร้านไม่ทำงาน
 * ซึ่งแย่กว่าตอนที่เขายังไม่จ่ายเสียอีก
 */
export async function restoreSuspendedQrCodes(
  ownerId: string,
): Promise<number> {
  const { data, error } = await admin().rpc("restore_suspended_qr_codes", {
    p_owner_id: ownerId,
  });

  if (error !== null) {
    throw new Error(`restore_suspended_qr_codes ล้มเหลว: ${error.message}`);
  }

  return data ?? 0;
}

/**
 * ลบ scan ดิบที่เลยกำหนดเก็บ (docs/decisions/0006-scan-analytics-privacy.md)
 *
 * อยู่ในไฟล์นี้เพราะเป็นที่เดียวที่มี client สิทธิ์ service role ไม่ใช่เพราะเกี่ยวกับ billing
 * การเก็บข้อมูลนานเกินที่ประกาศไว้คือการผิดคำสัญญากับผู้ใช้ งานนี้จึงพลาดไม่ได้
 */
export async function deleteExpiredScans(): Promise<number> {
  const { data, error } = await admin().rpc("delete_expired_scans");

  if (error !== null) {
    throw new Error(`delete_expired_scans ล้มเหลว: ${error.message}`);
  }

  return data ?? 0;
}
