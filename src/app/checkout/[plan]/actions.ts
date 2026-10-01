"use server";

import { redirect } from "next/navigation";
import {
  CHECKOUT_REJECTION_MESSAGES,
  priceCodeForSlug,
  startCheckout,
} from "@/lib/billing/checkout";
import {
  GatewayNotConfiguredError,
  isGatewayConfigured,
  startCharge,
} from "@/lib/billing/opn/charge";
import {
  countLifetimeSales,
  createCheckoutSession,
  loadSubscription,
} from "@/lib/billing/store";
import { createClient } from "@/lib/supabase/server";

export type CheckoutActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "promptpay";
      qrImageUrl: string;
      expiresAt: string;
    };

/**
 * ⚠️ ทุกฟังก์ชันที่ export จากไฟล์นี้กลายเป็น endpoint ที่เบราว์เซอร์เรียกได้
 * ห้าม export อะไรที่รับรหัสผู้ใช้เป็นพารามิเตอร์ — ต้องอ่านผู้ใช้จาก session เท่านั้น
 */

/**
 * เริ่มชำระเงิน
 *
 * ⚠️ รับแค่ slug ของแพ็กเกจจากฟอร์ม ไม่รับราคาหรือรหัสผู้ใช้เด็ดขาด
 * ราคามาจาก PRICES ฝั่งเซิร์ฟเวอร์ ผู้ใช้มาจาก session — ถ้ารับจากฟอร์ม
 * ใครก็แก้ราคาเป็น 1 บาทหรือซื้อในนามคนอื่นได้จาก devtools
 */
export async function beginCheckout(
  _previous: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const slug = String(formData.get("plan") ?? "");
  const priceCode = priceCodeForSlug(slug);
  if (priceCode === null) {
    return {
      status: "error",
      message: CHECKOUT_REJECTION_MESSAGES.unknown_price,
    };
  }

  // ยังไม่ได้เชื่อม gateway — ไม่บันทึกอะไรเลย ไม่งั้นจะมีแถว pending ค้างเต็มตาราง
  if (!isGatewayConfigured()) {
    return {
      status: "error",
      message: "ระบบชำระเงินกำลังเปิดใช้งาน ยังกดจ่ายไม่ได้ในตอนนี้",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) redirect(`/login?next=/checkout/${slug}`);

  const [subscription, lifetimeSold] = await Promise.all([
    loadSubscription(user.id),
    countLifetimeSales(),
  ]);

  const hasActiveLifetime =
    subscription !== null &&
    subscription.billingKind === "lifetime" &&
    subscription.status !== "canceled";

  const checkoutId = crypto.randomUUID();
  const result = startCheckout({
    checkoutId,
    ownerId: user.id,
    priceCode,
    hasActiveLifetime,
    lifetimeSold,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: CHECKOUT_REJECTION_MESSAGES[result.reason],
    };
  }

  await createCheckoutSession({
    checkoutId,
    ownerId: user.id,
    priceCode: result.intent.priceCode,
    amountSatang: result.intent.amountSatang,
  });

  let started: Awaited<ReturnType<typeof startCharge>>;
  try {
    started = await startCharge(result.intent);
  } catch (error) {
    if (error instanceof GatewayNotConfiguredError) {
      return {
        status: "error",
        message: "ระบบชำระเงินกำลังเปิดใช้งาน ยังกดจ่ายไม่ได้ในตอนนี้",
      };
    }
    console.error("[checkout] เริ่มเก็บเงินไม่สำเร็จ", checkoutId, error);
    return {
      status: "error",
      message: "เริ่มการชำระเงินไม่สำเร็จ ยังไม่มีการตัดเงิน ลองใหม่อีกครั้ง",
    };
  }

  if (started.kind === "redirect") redirect(started.url);

  return {
    status: "promptpay",
    qrImageUrl: started.qrImageUrl,
    expiresAt: started.expiresAt.toISOString(),
  };
}
