"use server";

import { revalidatePath } from "next/cache";
import { checkQuota, toContext } from "@/lib/billing/entitlements";
import { generateShortcode } from "@/lib/dynamic/shortcode";
import { stripLogo } from "@/lib/qr/draft";
import { canBeDynamic } from "@/lib/qr/dynamic-support";
import type { ErrorCorrectionLevel } from "@/lib/qr/encode";
import { buildPayload } from "@/lib/qr/payload";
import type { QrStyle } from "@/lib/qr/style";
import type { QrData } from "@/lib/qr/types";
import { createClient } from "@/lib/supabase/server";

export type SaveQrInput = {
  title: string;
  data: QrData;
  style: QrStyle;
  level: ErrorCorrectionLevel;
  asDynamic: boolean;
};

export type SaveQrResult =
  | { status: "saved"; id: string; shortcode: string | null }
  | { status: "needs-login" }
  | { status: "error"; message: string };

export async function saveQr(input: SaveQrInput): Promise<SaveQrResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) return { status: "needs-login" };

  const wantsDynamic = input.asDynamic && canBeDynamic(input.data.type);

  if (wantsDynamic) {
    // ตรวจสิทธิ์ผ่านชั้น entitlements ซึ่งไม่รู้จัก payment gateway (docs/prd.md §5.1)
    const [{ data: subscription }, { data: grants }, { count }] =
      await Promise.all([
        supabase
          .from("subscriptions")
          .select("plan, status, grace_until")
          .maybeSingle(),
        supabase.from("entitlements").select("feature, quota, expires_at"),
        supabase
          .from("qr_codes")
          .select("id", { count: "exact", head: true })
          .eq("kind", "dynamic")
          .eq("status", "active"),
      ]);

    const quota = checkQuota(
      toContext(subscription, grants ?? []),
      "dynamic_qr",
      count ?? 0,
    );

    if (!quota.allowed) {
      return {
        status: "error",
        message: `แพ็กเกจปัจจุบันสร้าง QR ที่แก้ปลายทางได้ ${quota.limit} อัน — เก็บอันเก่าเข้าคลังหรืออัปเกรดก่อน`,
      };
    }
  }

  // โลโก้ยังเก็บไม่ได้จนกว่าจะย้ายไป Supabase Storage — ตัดออกก่อนบันทึกเสมอ
  const style = stripLogo(input.style);
  const title = input.title.trim().slice(0, 120);

  // dynamic ต้องมีปลายทางเป็น URL ซึ่ง buildPayload คืนมาให้อยู่แล้วสำหรับสองประเภทนี้
  const target = wantsDynamic ? buildPayload(input.data) : null;

  // ชนกันแทบเป็นไปไม่ได้ (31^7) แต่ถ้าชนก็แค่สุ่มใหม่ ไม่ต้องเช็คก่อนเขียน
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shortcode = wantsDynamic ? generateShortcode() : null;

    const { data, error } = await supabase
      .from("qr_codes")
      .insert({
        owner_id: user.id,
        kind: wantsDynamic ? "dynamic" : "static",
        title,
        qr_type: input.data.type,
        content: input.data as never,
        style: { ...style, level: input.level } as never,
        shortcode,
        current_target: target,
      })
      .select("id, shortcode")
      .single();

    if (error === null && data !== null) {
      if (wantsDynamic) {
        await supabase.rpc("set_qr_target", {
          qr_id: data.id,
          new_target: target ?? "",
        });
      }
      revalidatePath("/dashboard");
      return { status: "saved", id: data.id, shortcode: data.shortcode };
    }

    // 23505 = unique violation, 23514 = check violation จาก blocklist ของ shortcode
    const retryable = error?.code === "23505" || error?.code === "23514";
    if (!retryable) {
      return { status: "error", message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
    }
  }

  return { status: "error", message: "สร้างรหัสลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง" };
}

export type ClaimResult = { saved: number; failed: number };

/** ดึง draft ที่ค้างในเครื่องเข้าบัญชีหลังผู้ใช้ล็อกอินแล้ว */
export async function claimDrafts(drafts: SaveQrInput[]): Promise<ClaimResult> {
  let saved = 0;
  let failed = 0;

  for (const draft of drafts) {
    const result = await saveQr(draft);
    if (result.status === "saved") saved += 1;
    else failed += 1;
  }

  return { saved, failed };
}
