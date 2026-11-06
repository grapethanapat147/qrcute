import type { Metadata } from "next";
import { QrChecker } from "@/components/qr/qr-checker";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/seo/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { breadcrumbSchema, organizationSchema } from "@/lib/seo/json-ld";
import { absoluteUrl, siteConfig } from "@/lib/site";

const url = absoluteUrl("/check");

export const metadata: Metadata = {
  title: "ตรวจ QR Code ว่าจะหมดอายุไหม — ฟรี",
  description:
    "อัปโหลดรูป QR ที่ใช้อยู่ แล้วรู้ทันทีว่าเป็น QR ที่ไม่มีวันหมดอายุ หรือ QR ที่จะหยุดทำงานเมื่อเลิกจ่ายค่าบริการ",
  alternates: { canonical: url, languages: { th: url, "x-default": url } },
};

export default function CheckPage() {
  const trail = [
    { name: "หน้าแรก", path: "/" },
    { name: "ตรวจ QR", path: "/check" },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd nodes={[organizationSchema(), breadcrumbSchema(trail)]} />
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Breadcrumbs trail={trail} />
        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">
          QR ของคุณจะหมดอายุไหม?
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          QR หลายตัวที่คิดว่าสร้างฟรีจริง ๆ แล้วเก็บลิงก์ของบริการที่สร้างมัน
          พอเลิกจ่ายหรือหมดช่วงทดลอง ป้ายที่พิมพ์ไปแล้วก็ใช้ไม่ได้ ตรวจได้ที่นี่ในไม่กี่วินาที
        </p>
        <div className="mt-10">
          <QrChecker ownHost={new URL(siteConfig.url).host} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
