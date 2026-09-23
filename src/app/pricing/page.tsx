import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, FaqSection } from "@/components/seo/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  PRICING_DISCLOSURES,
  PRICING_FAQ,
  PRICING_FEATURES,
  PRICING_PLANS,
} from "@/lib/billing/pricing-content";
import {
  breadcrumbSchema,
  faqSchema,
  organizationSchema,
  softwareApplicationSchema,
} from "@/lib/seo/json-ld";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * หน้าราคา
 *
 * ลำดับบนหน้าเป็นเรื่องตั้งใจ: การ์ดราคา → ตารางเทียบ → สิ่งที่ต้องรู้ก่อนซื้อ → FAQ
 * ส่วน "สิ่งที่ต้องรู้ก่อนซื้อ" อยู่เหนือ FAQ ไม่ใช่ซ่อนอยู่ในนั้น เพราะ business
 * invariant ข้อ 3 บังคับให้บอกผลของการเลิกจ่ายก่อนผู้ใช้ตัดสินใจ ไม่ใช่ตอนจะยกเลิก
 * และข้อจำกัดของพร้อมเพย์เป็นเรื่องที่คนไทยส่วนใหญ่เข้ามาเพราะสิ่งนี้โดยเฉพาะ
 */

const url = absoluteUrl("/pricing");

export const metadata: Metadata = {
  title: "ราคา — เริ่มฟรี ไม่มีวันหมดอายุ",
  description: `ราคา ${siteConfig.name} — สร้าง QR Code ฟรีไม่จำกัด อัปเกรดเมื่อต้องการ QR ที่แก้ปลายทางได้ สถิติการสแกน และไฟล์สำหรับงานพิมพ์`,
  alternates: {
    canonical: url,
    languages: { th: url, "x-default": url },
  },
  openGraph: {
    type: "website",
    url,
    title: `ราคา ${siteConfig.name}`,
    description: "เริ่มฟรี ไม่ต้องสมัครสมาชิก อัปเกรดเมื่อต้องการแก้ปลายทางได้",
  },
};

export default function PricingPage() {
  const trail = [
    { name: "หน้าแรก", path: "/" },
    { name: "ราคา", path: "/pricing" },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd
        nodes={[
          organizationSchema(),
          softwareApplicationSchema({
            name: siteConfig.name,
            description: siteConfig.description,
            url: absoluteUrl("/"),
          }),
          faqSchema(PRICING_FAQ),
          breadcrumbSchema(trail),
        ]}
      />

      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Breadcrumbs trail={trail} />

        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">
          เริ่มฟรี จ่ายเมื่อต้องการแก้ปลายทางได้
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          QR ที่สร้างฟรีไม่มีวันหมดอายุจริง ๆ แม้เราเลิกให้บริการ
          สิ่งที่คุณจ่ายคือของที่ต้องมีเราคอยดูแลต่อเท่านั้น
        </p>

        <section aria-labelledby="plans" className="mt-12">
          <h2 id="plans" className="sr-only">
            แพ็กเกจและราคา
          </h2>
          <ul className="grid gap-5 lg:grid-cols-4">
            {PRICING_PLANS.map((plan) => (
              <li
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-xl border p-6",
                  plan.featured && "border-primary ring-1 ring-primary",
                )}
              >
                {plan.badge !== undefined && (
                  <span className="mb-3 self-start rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    {plan.badge}
                  </span>
                )}

                <h3 className="font-semibold">{plan.name}</h3>
                <p className="mt-3 text-3xl font-bold">{plan.price}</p>
                <p className="text-sm text-muted-foreground">{plan.cadence}</p>

                <p className="mt-4 text-sm text-muted-foreground">
                  {plan.bestFor}
                </p>

                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {plan.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2">
                      <span aria-hidden className="text-primary">
                        ✓
                      </span>
                      <span className="text-muted-foreground">{highlight}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={plan.featured ? "default" : "outline"}
                  className="mt-6 w-full"
                >
                  <Link href={plan.id === "free" ? "/" : "/login"}>
                    {plan.cta}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="compare" className="mt-20">
          <h2 id="compare" className="text-2xl font-semibold">
            เทียบแบบละเอียด
          </h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="py-3 pr-4 font-medium">
                    ความสามารถ
                  </th>
                  <th scope="col" className="w-32 py-3 pr-4 font-medium">
                    ฟรี
                  </th>
                  <th scope="col" className="w-32 py-3 font-medium">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {PRICING_FEATURES.map((feature) => (
                  <tr key={feature.label} className="border-b last:border-0">
                    <td className="py-4 pr-4 align-top">
                      <span className="font-medium">{feature.label}</span>
                      {feature.note !== undefined && (
                        <span className="mt-1 block text-muted-foreground">
                          {feature.note}
                        </span>
                      )}
                    </td>
                    <td className="py-4 pr-4 align-top text-muted-foreground">
                      {feature.free}
                    </td>
                    <td className="py-4 align-top text-muted-foreground">
                      {feature.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="disclosures" className="mt-20 max-w-3xl">
          <h2 id="disclosures" className="text-2xl font-semibold">
            สิ่งที่ควรรู้ก่อนตัดสินใจ
          </h2>
          <div className="mt-6 space-y-8">
            {PRICING_DISCLOSURES.map((item) => (
              <div
                key={item.heading}
                className="rounded-lg border-l-2 border-primary bg-muted/40 p-5"
              >
                <h3 className="font-semibold">{item.heading}</h3>
                {item.body.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 24)}
                    className="mt-2 text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="faq" className="mt-20 max-w-3xl">
          <h2 id="faq" className="text-2xl font-semibold">
            คำถามที่พบบ่อย
          </h2>
          <FaqSection items={PRICING_FAQ} />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
