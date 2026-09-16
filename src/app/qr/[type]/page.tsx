import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QrGenerator } from "@/components/qr/qr-generator";
import { JsonLd } from "@/components/seo/json-ld";
import {
  Breadcrumbs,
  FaqSection,
  RelatedLinks,
  StepList,
} from "@/components/seo/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  breadcrumbSchema,
  faqSchema,
  howToSchema,
  organizationSchema,
  softwareApplicationSchema,
} from "@/lib/seo/json-ld";
import { findTypePage, TYPE_PAGE_LIST } from "@/lib/seo/type-pages";
import { absoluteUrl } from "@/lib/site";

/**
 * หน้า generator แยกตามประเภท — cluster ลำดับ 2 ใน docs/seo.md §3
 *
 * ⚠️ เนื้อหาทั้งหมดมาจาก src/lib/seo/type-pages.ts ห้ามเขียน copy ลงในไฟล์นี้
 * เพราะ sitemap, footer และ JSON-LD อ้างอิงแหล่งเดียวกัน
 * ถ้าหน้านี้มีข้อความที่ไม่มีในนั้น ตัวตรวจว่าเนื้อหาซ้ำกันไหมจะมองไม่เห็น
 *
 * generator ทำงานบนหน้านี้เลย ไม่ redirect ไปหน้าแรก ตามกฎกัน doorway penalty
 * ใน docs/seo.md §4 ข้อ 1
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return TYPE_PAGE_LIST.map((page) => ({ type: page.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/qr/[type]">): Promise<Metadata> {
  const { type } = await params;
  const page = findTypePage(type);
  if (page === undefined) return {};

  const url = absoluteUrl(`/qr/${page.slug}`);

  return {
    title: page.title,
    description: page.metaDescription,
    alternates: {
      canonical: url,
      // ADR 0003 — ประกาศ th และ x-default ตั้งแต่ยังไม่มี en
      languages: { th: url, "x-default": url },
    },
    openGraph: {
      type: "website",
      url,
      title: page.title,
      description: page.metaDescription,
    },
  };
}

function GeneratorFallback() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
      <div className="aspect-square animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export default async function QrTypePage({ params }: PageProps<"/qr/[type]">) {
  const { type } = await params;
  const page = findTypePage(type);
  if (page === undefined) notFound();

  const url = absoluteUrl(`/qr/${page.slug}`);
  const trail = [
    { name: "หน้าแรก", path: "/" },
    { name: page.h1, path: `/qr/${page.slug}` },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd
        nodes={[
          organizationSchema(),
          softwareApplicationSchema({
            name: page.h1,
            description: page.metaDescription,
            url,
          }),
          howToSchema({ name: page.h1, steps: page.steps }),
          faqSchema(page.faq),
          breadcrumbSchema(trail),
        ]}
      />

      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Breadcrumbs trail={trail} />

        <h1 className="mt-6 max-w-3xl text-3xl font-bold sm:text-4xl">
          {page.h1}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          {page.lede}
        </p>

        <div className="mt-10">
          {/* useSearchParams ต้องอยู่ใต้ Suspense ไม่งั้น client tree หลุดจากการ prerender */}
          <Suspense fallback={<GeneratorFallback />}>
            <QrGenerator initialType={page.type} />
          </Suspense>
        </div>

        <section className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-semibold">{page.aboutHeading}</h2>
          <div className="mt-4 space-y-4 text-muted-foreground">
            {page.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-semibold">วิธีทำทีละขั้น</h2>
          <StepList steps={page.steps} />
        </section>

        <section className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-semibold">คำถามที่พบบ่อย</h2>
          <FaqSection items={page.faq} />
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold">อ่านต่อ</h2>
          <RelatedLinks links={page.related} />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
