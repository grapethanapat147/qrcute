import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { QrGenerator } from "@/components/qr/qr-generator";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo/json-ld";
import { TYPE_PAGE_LIST } from "@/lib/seo/type-pages";
import { USE_CASES } from "@/lib/seo/use-cases";
import { absoluteUrl, siteConfig } from "@/lib/site";

/**
 * หน้าแรกทำสองหน้าที่พร้อมกัน
 *
 * 1. generator ที่ใช้ได้ภายใน 5 วินาทีโดยไม่ต้องสมัคร (business invariant ข้อ 2)
 * 2. hub ของโครง internal link ตาม docs/seo.md §6 — ลิงก์ไปทุก type page
 *
 * ลำดับสำคัญ: generator ต้องอยู่เหนือ fold ส่วนลิงก์ทั้งหมดอยู่ใต้ลงไป
 * ถ้าสลับกันเมื่อไรคือทำลายเหตุผลที่คนเข้ามาตั้งแต่แรก
 */

export const metadata: Metadata = {
  alternates: {
    canonical: absoluteUrl("/"),
    // ADR 0003 — ประกาศ th และ x-default ไว้ตั้งแต่ยังไม่มีหน้า en
    languages: { th: absoluteUrl("/"), "x-default": absoluteUrl("/") },
  },
};

function GeneratorFallback() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
      <div className="aspect-square animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd
        nodes={[
          organizationSchema(),
          websiteSchema(),
          softwareApplicationSchema({
            name: siteConfig.name,
            description: siteConfig.description,
            url: absoluteUrl("/"),
          }),
        ]}
      />

      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <h1 className="max-w-3xl text-4xl font-bold sm:text-5xl">
          สร้าง QR Code ฟรี ไม่มีวันหมดอายุ
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {siteConfig.description}
        </p>

        <div className="mt-10">
          {/*
            useSearchParams ต้องอยู่ใต้ Suspense ไม่งั้น client component tree
            ทั้งก้อนจะหลุดจากการ prerender (ดู docs ของ Next 16)
          */}
          <Suspense fallback={<GeneratorFallback />}>
            <QrGenerator />
          </Suspense>
        </div>

        <section className="mt-20">
          <h2 className="text-2xl font-semibold">สร้าง QR Code แยกตามประเภท</h2>
          <p className="mt-2 text-muted-foreground">
            แต่ละหน้ามีฟอร์มเฉพาะประเภทนั้น พร้อมวิธีทำและข้อควรระวังที่ต่างกัน
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TYPE_PAGE_LIST.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/qr/${page.slug}`}
                  className="block h-full rounded-lg border p-5 hover:border-primary"
                >
                  <h3 className="font-semibold">{page.h1}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {page.lede}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold">
            ธุรกิจแบบคุณควรใช้ QR Code ยังไง
          </h2>
          <p className="mt-2 text-muted-foreground">
            เลือกประเภทธุรกิจเพื่อดูว่าควรทำ QR อะไรก่อน
            และคนทำร้านแบบเดียวกันพลาดตรงไหนบ่อย
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/use-case/${page.slug}`}
                  className="block h-full rounded-lg border p-5 hover:border-primary"
                >
                  <h3 className="font-semibold">{page.h1}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {page.lede}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
