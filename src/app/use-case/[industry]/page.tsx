import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import {
  Breadcrumbs,
  FaqSection,
  RelatedLinks,
} from "@/components/seo/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  breadcrumbSchema,
  faqSchema,
  organizationSchema,
} from "@/lib/seo/json-ld";
import { TYPE_PAGES } from "@/lib/seo/type-pages";
import { findUseCase, USE_CASES } from "@/lib/seo/use-cases";
import { absoluteUrl } from "@/lib/site";

/**
 * หน้าแยกตามประเภทธุรกิจ — cluster ลำดับ 3 ใน docs/seo.md §3
 *
 * ต่างจาก /qr/[type] ตรงที่หน้านี้ไม่มี generator อยู่บนหน้า
 * เพราะคำถามของคนที่เข้ามาคือ "ร้านแบบผมควรใช้ QR ยังไง" ไม่ใช่ "ขอเครื่องมือ"
 * การยัด generator มาไว้บนสุดจะตอบผิดคำถามและดันเนื้อหาที่เขาต้องการลงไปใต้ fold
 * แทนที่ด้วยการชี้ไปหน้า /qr/[type] ที่ตรงกับธุรกิจนั้นแทน
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return USE_CASES.map((page) => ({ industry: page.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/use-case/[industry]">): Promise<Metadata> {
  const { industry } = await params;
  const page = findUseCase(industry);
  if (page === undefined) return {};

  const url = absoluteUrl(`/use-case/${page.slug}`);

  return {
    title: page.title,
    description: page.metaDescription,
    alternates: {
      canonical: url,
      languages: { th: url, "x-default": url },
    },
    openGraph: {
      type: "article",
      url,
      title: page.title,
      description: page.metaDescription,
    },
  };
}

export default async function UseCasePage({
  params,
}: PageProps<"/use-case/[industry]">) {
  const { industry } = await params;
  const page = findUseCase(industry);
  if (page === undefined) notFound();

  const trail = [
    { name: "หน้าแรก", path: "/" },
    { name: page.h1, path: `/use-case/${page.slug}` },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd
        nodes={[
          organizationSchema(),
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

        <div className="mt-8 max-w-3xl space-y-4 text-muted-foreground">
          {page.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold">ควรทำ QR อะไรบ้าง</h2>
          <ul className="mt-6 grid gap-4 lg:grid-cols-3">
            {page.recommended.map((item, index) => {
              const target = TYPE_PAGES[item.type];
              return (
                <li key={item.type} className="rounded-lg border p-5">
                  <p className="text-sm text-muted-foreground">
                    ลำดับที่ {index + 1}
                  </p>
                  <h3 className="mt-1 font-semibold">{item.label}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.why}
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link href={`/qr/${target.slug}`}>{target.h1}</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-semibold">ข้อผิดพลาดที่เจอบ่อย</h2>
          <ul className="mt-6 space-y-5">
            {page.pitfalls.map((item) => (
              <li
                key={item.title}
                className="border-l-2 border-destructive pl-4"
              >
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1 text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
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
