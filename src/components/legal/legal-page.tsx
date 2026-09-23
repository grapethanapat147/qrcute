import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/seo/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { LegalDocument, LegalSection } from "@/lib/legal/types";
import { breadcrumbSchema, organizationSchema } from "@/lib/seo/json-ld";
import { absoluteUrl } from "@/lib/site";

/**
 * ตัวเรนเดอร์หน้ากฎหมายทั้งสามหน้า
 *
 * ตั้งใจให้อ่านง่ายกว่าหน้ากฎหมายทั่วไป ย่อหน้าสั้น ใช้ตารางแทนความยาว ๆ
 * และมีกล่องเน้นเฉพาะข้อที่ผู้ใช้เสียหายมากที่สุดถ้าอ่านข้าม
 * เอกสารที่ไม่มีใครอ่านจนจบไม่ได้ปกป้องใครเลย ทั้งผู้ใช้และเรา
 */

const DATE_FORMAT = new Intl.DateTimeFormat("th-TH", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function legalMetadata(doc: LegalDocument): Metadata {
  const url = absoluteUrl(`/${doc.slug}`);

  return {
    title: doc.title,
    description: doc.metaDescription,
    alternates: {
      canonical: url,
      languages: { th: url, "x-default": url },
    },
    openGraph: {
      type: "article",
      url,
      title: doc.title,
      description: doc.metaDescription,
    },
  };
}

function SectionBody({ section }: { section: LegalSection }) {
  return (
    <>
      {section.body?.map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className="mt-3 text-muted-foreground">
          {paragraph}
        </p>
      ))}

      {section.list !== undefined && (
        <ul className="mt-4 space-y-3">
          {section.list.map((item) => (
            <li key={item.detail.slice(0, 24)} className="flex gap-3">
              <span
                aria-hidden
                className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground"
              />
              <span className="text-muted-foreground">
                {item.term !== undefined && (
                  <strong className="font-medium text-foreground">
                    {item.term} —{" "}
                  </strong>
                )}
                {item.detail}
              </span>
            </li>
          ))}
        </ul>
      )}

      {section.table !== undefined && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                {section.table.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="py-2 pr-4 font-medium"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row[0]} className="border-b last:border-0">
                  <td className="py-3 pr-4 align-top font-medium">{row[0]}</td>
                  <td className="py-3 align-top text-muted-foreground">
                    {row[1]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.callout !== undefined && (
        <p className="mt-4 rounded-lg border-l-2 border-primary bg-muted/40 p-4">
          {section.callout}
        </p>
      )}
    </>
  );
}

export function LegalPage({ document: doc }: { document: LegalDocument }) {
  const trail = [
    { name: "หน้าแรก", path: "/" },
    { name: doc.h1, path: `/${doc.slug}` },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd nodes={[organizationSchema(), breadcrumbSchema(trail)]} />

      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Breadcrumbs trail={trail} />

        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">{doc.h1}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{doc.lede}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          มีผลบังคับใช้ตั้งแต่{" "}
          <time dateTime={doc.effectiveDate}>
            {DATE_FORMAT.format(new Date(doc.effectiveDate))}
          </time>
        </p>

        <div className="mt-12 space-y-12">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold">{section.heading}</h2>
              <SectionBody section={section} />
            </section>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
