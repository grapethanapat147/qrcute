import type { Plan, SubscriptionStatus } from "./entitlements";
import { type BillingKind, isPriceCode, PRICES, periodEndFrom } from "./plans";

/**
 * แปลงเหตุการณ์จาก gateway เป็น "เจตนา" ที่ระบบสิทธิ์เข้าใจ แล้วเอาไปทับสถานะเดิม
 *
 * แยกเป็นฟังก์ชันบริสุทธิ์เพราะสองข้อกำหนดที่พลาดไม่ได้ใน docs/prd.md §5.1
 * ทดสอบได้ที่นี่ที่เดียวโดยไม่ต้องมี key จริง:
 * 1. ยิงเหตุการณ์เดิมซ้ำหลายครั้ง สิทธิ์ต้องไม่เปลี่ยนเกินหนึ่งครั้ง
 * 2. คนที่ซื้อแบบจ่ายครั้งเดียว ต้องไม่ถูกลดระดับเพราะเหตุการณ์ของ subscription อื่น
 */

/** จำนวนวันผ่อนผันเมื่อเก็บเงินไม่สำเร็จ — ดู docs/decisions/0008-downgrade-behaviour.md */
export const GRACE_DAYS = 30;

export type BillingIntent =
  | {
      type: "activate";
      plan: Plan;
      billingKind: BillingKind;
      paidAt: Date;
    }
  | { type: "payment_failed"; failedAt: Date }
  | { type: "cancel" }
  | { type: "ignore"; reason: string };

export type SubscriptionState = {
  plan: Plan;
  billingKind: BillingKind | null;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  graceUntil: Date | null;
};

export const FREE_STATE: SubscriptionState = {
  plan: "free",
  billingKind: null,
  status: "active",
  currentPeriodEnd: null,
  graceUntil: null,
};

/** เหตุการณ์ดิบเท่าที่เราต้องใช้ — ไม่ผูกกับรูปแบบของเจ้าใดเจ้าหนึ่งเกินจำเป็น */
export type GatewayEvent = {
  id: string;
  key: string;
  createdAt: Date;
  /** สถานะของ charge เช่น successful / failed / pending */
  chargeStatus?: string;
  /** รหัสสินค้าที่เราแนบไปตอนสร้าง charge */
  priceCode?: string;
};

/**
 * แปลงเหตุการณ์เป็นเจตนา
 *
 * ⚠️ รองรับเฉพาะเหตุการณ์ตระกูล charge.* ซึ่งมีเอกสารยืนยันชัดเจน
 * เหตุการณ์ตระกูล schedule.* (การต่ออายุอัตโนมัติ) ยังไม่รองรับ เพราะเอกสารสาธารณะ
 * ไม่ได้ระบุชื่อ event ครบ — ห้ามเดา ต้องดูจากเหตุการณ์จริงในแดชบอร์ดก่อน
 * ดู TODO ท้ายไฟล์
 */
export function toIntent(event: GatewayEvent): BillingIntent {
  if (event.key !== "charge.complete" && event.key !== "charge.create") {
    return { type: "ignore", reason: `ยังไม่รองรับเหตุการณ์ ${event.key}` };
  }

  if (event.chargeStatus === "failed") {
    return { type: "payment_failed", failedAt: event.createdAt };
  }

  if (event.chargeStatus !== "successful") {
    return { type: "ignore", reason: `charge ยังไม่จบ (${event.chargeStatus})` };
  }

  if (event.priceCode === undefined || !isPriceCode(event.priceCode)) {
    // จ่ายเงินสำเร็จแต่ไม่รู้ว่าซื้ออะไร — ต้องไม่เดา ปล่อยให้คนตรวจสอบเอง
    return { type: "ignore", reason: "ไม่พบรหัสสินค้าในเหตุการณ์" };
  }

  const price = PRICES[event.priceCode];
  return {
    type: "activate",
    plan: price.plan,
    billingKind: price.billingKind,
    paidAt: event.createdAt,
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** ผู้ที่ซื้อแบบจ่ายครั้งเดียวและยังไม่ถูกยกเลิก */
function isLifetimeHolder(state: SubscriptionState): boolean {
  return state.billingKind === "lifetime" && state.status !== "canceled";
}

/**
 * ทับสถานะเดิมด้วยเจตนาใหม่
 *
 * ต้องเป็น idempotent: เอาเจตนาเดิมมาทับซ้ำต้องได้ผลเท่าเดิม
 * ซึ่งเป็นจริงเพราะทุกกิ่งคำนวณสถานะใหม่จากข้อมูลในเจตนา ไม่มีการบวกสะสม
 */
export function applyIntent(
  state: SubscriptionState,
  intent: BillingIntent,
): SubscriptionState {
  switch (intent.type) {
    case "ignore":
      return state;

    case "activate": {
      // ซื้อจ่ายครั้งเดียวไปแล้ว ห้ามถูกลดระดับด้วยรายการที่เล็กกว่า
      // เช่นเผลอสมัครรายเดือนทีหลัง หรือ webhook เก่ามาถึงช้า
      if (isLifetimeHolder(state) && intent.billingKind !== "lifetime") {
        return state;
      }

      return {
        plan: intent.plan,
        billingKind: intent.billingKind,
        status: "active",
        currentPeriodEnd: periodEndFrom(intent.billingKind, intent.paidAt),
        graceUntil: null,
      };
    }

    case "payment_failed": {
      // จ่ายครั้งเดียวแล้วไม่มีอะไรให้เก็บซ้ำ เหตุการณ์นี้ต้องไม่แตะสิทธิ์เขา
      if (isLifetimeHolder(state)) return state;

      return {
        ...state,
        status: "past_due",
        graceUntil: addDays(intent.failedAt, GRACE_DAYS),
      };
    }

    case "cancel": {
      if (isLifetimeHolder(state)) return state;
      return { ...state, status: "canceled", graceUntil: null };
    }
  }
}

/**
 * TODO ก่อนเปิดขายแบบต่ออายุอัตโนมัติ
 *
 * ต้องยืนยันชื่อเหตุการณ์ของการต่ออายุ (ตระกูล schedule.*) จากเหตุการณ์จริง
 * ในแดชบอร์ดของ Opn ก่อน แล้วค่อยเพิ่มใน toIntent
 * ระหว่างนี้การต่ออายุจะไม่ถูกบันทึกอัตโนมัติ — ขายได้เฉพาะรายการที่เก็บเงินครั้งเดียว
 */
export const RECURRING_EVENTS_SUPPORTED = false;
