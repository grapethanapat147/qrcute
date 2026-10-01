import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RECURRING_EVENTS_SUPPORTED } from "@/lib/billing/billing-events";
import {
  CHECKOUT_REJECTION_MESSAGES,
  type CHECKOUT_SLUGS,
  priceCodeForSlug,
  startCheckout,
} from "@/lib/billing/checkout";
import { isGatewayConfigured } from "@/lib/billing/opn/charge";
import { formatSatang, PRICES } from "@/lib/billing/plans";
import {
  PRICING_DISCLOSURES,
  PRICING_PLANS,
} from "@/lib/billing/pricing-content";
import { countLifetimeSales, loadSubscription } from "@/lib/billing/store";
import { createClient } from "@/lib/supabase/server";
import { CheckoutButton } from "./checkout-button";

/**
 * หน้ายืนยันก่อนชำระเงิน
 *
 * business invariant ข้อ 3 บังคับให้บอกผลของการเลิกจ่ายก่อนผู้ใช้ตัดสินใจ
 * หน้านี้คือจุดสุดท้ายก่อนเงินออกจากกระเป๋า จึงแสดงซ้ำแม้หน้าราคาบอกไปแล้ว
 * คนจำนวนมากกดจากลิงก์ที่แชร์มาตรงนี้โดยไม่เคยเห็นหน้าราคาเลย
 */

/**
 * ข้อความเรื่องการต่ออายุ — ต้องตรงกับสิ่งที่ระบบทำได้จริงเท่านั้น
 *
 * ⚠️ ห้ามบอกว่า "ต่ออายุอัตโนมัติ" ระหว่างที่ RECURRING_EVENTS_SUPPORTED ยังเป็น false
 * เพราะเหตุการณ์ของการต่ออายุจะถูกข้าม (billing-events.ts) ลูกค้าที่ถูกตัดเงินรอบสอง
 * จะไม่ได้สิทธิ์ต่อ — สัญญาสิ่งที่ทำไม่ได้ตรงนี้คือเก็บเงินแล้วไม่ส่งของ
 */
function renewalNote(billingKind: string, requiresCard: boolean): string {
  if (billingKind === "lifetime") {
    return "ชำระด้วยพร้อมเพย์ได้ ไม่ต้องมีบัตรเครดิต จ่ายครั้งเดียวไม่มีการต่ออายุ";
  }

  const period = billingKind === "yearly" ? "12 เดือน" : "1 เดือน";
  if (!RECURRING_EVENTS_SUPPORTED) {
    return `ชำระครั้งเดียวสำหรับ ${period} ยังไม่มีการต่ออายุอัตโนมัติ เมื่อครบกำหนดต้องกดต่ออายุเอง`;
  }

  return requiresCard
    ? "ชำระด้วยบัตรเครดิตหรือเดบิต ระบบจะต่ออายุให้อัตโนมัติจนกว่าคุณจะยกเลิก"
    : `ชำระสำหรับ ${period}`;
}

export const metadata: Metadata = {
  title: "ยืนยันการสั่งซื้อ",
  // หน้านี้ผูกกับบัญชีของแต่ละคน ไม่มีประโยชน์ในผลค้นหา
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  params,
}: PageProps<"/checkout/[plan]">) {
  const { plan: slug } = await params;
  const priceCode = priceCodeForSlug(slug);
  if (priceCode === null) notFound();

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

  // ตรวจล่วงหน้าเพื่อบอกเหตุผลก่อนกด ไม่ใช่ปล่อยให้กดแล้วค่อยปฏิเสธ
  // การตรวจจริงเกิดซ้ำอีกครั้งใน action ตอนกดจ่าย ห้ามพึ่งผลตรงนี้
  const preview = startCheckout({
    checkoutId: "00000000-0000-0000-0000-000000000000",
    ownerId: user.id,
    priceCode,
    hasActiveLifetime,
    lifetimeSold,
  });

  const price = PRICES[priceCode];
  const card = PRICING_PLANS.find((item) => item.id === slug);
  const gatewayReady = isGatewayConfigured();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <Link
          href="/pricing"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← กลับไปดูแพ็กเกจอื่น
        </Link>

        <h1 className="mt-6 text-3xl font-bold">ยืนยันการสั่งซื้อ</h1>

        <section className="mt-8 rounded-xl border p-6">
          <h2 className="font-semibold">{price.label}</h2>
          <p className="mt-2 text-3xl font-bold">
            {formatSatang(price.amountSatang)}
          </p>
          <p className="text-sm text-muted-foreground">{card?.cadence}</p>

          {card !== undefined && (
            <ul className="mt-5 space-y-2 text-sm">
              {card.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-2">
                  <span aria-hidden className="text-primary">
                    ✓
                  </span>
                  <span className="text-muted-foreground">{highlight}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-5 text-sm text-muted-foreground">
            {renewalNote(price.billingKind, price.requiresCard)}
          </p>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="font-semibold">ก่อนกดจ่าย</h2>
          {PRICING_DISCLOSURES.map((item) => (
            <div
              key={item.heading}
              className="rounded-lg border-l-2 border-primary bg-muted/40 p-4 text-sm"
            >
              <p className="font-medium">{item.heading}</p>
              {/*
                แสดงครบทุกย่อหน้าโดยตั้งใจ — ย่อหน้าหลัง ๆ คือลำดับเวลา 30/120 วัน
                ของ QR แบบแก้ปลายทางได้ ซึ่ง business invariant ข้อ 3 บังคับให้บอก
                ก่อนจ่ายเงิน ถ้าตัดเหลือย่อหน้าแรกจะบอกแค่ส่วนที่ไม่มีผลกระทบ
              */}
              {item.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="mt-1 text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </section>

        <section className="mt-8">
          {preview.ok ? (
            <CheckoutButton
              plan={slug as keyof typeof CHECKOUT_SLUGS}
              label={`ชำระ ${formatSatang(price.amountSatang)}`}
              disabled={!gatewayReady}
            />
          ) : (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              {CHECKOUT_REJECTION_MESSAGES[preview.reason]}
            </p>
          )}

          {preview.ok && !gatewayReady && (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              ระบบชำระเงินกำลังเปิดใช้งาน ยังกดจ่ายไม่ได้ในตอนนี้
            </p>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            การกดชำระเงินถือว่ายอมรับ{" "}
            <Link href="/terms" className="underline">
              เงื่อนไขการใช้งาน
            </Link>{" "}
            · ขอคืนเงินเต็มจำนวนได้ภายใน 7 วัน ดู{" "}
            <Link href="/refund" className="underline">
              นโยบายการคืนเงิน
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
