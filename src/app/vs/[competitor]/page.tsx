import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/seo/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { COMPARISONS, findComparison } from "@/lib/seo/comparisons";
import { breadcrumbSchema, organizationSchema } from "@/lib/seo/json-ld";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARISONS.map((item) => ({ competitor: item.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/vs/[competitor]">): Promise<Metadata> {
  const item = findComparison((await params).competitor);
  if (item === undefined) return {};
  const url = absoluteUrl(`/vs/${item.slug}`);
  return {
    // absolute เพราะ title มีชื่อแบรนด์อยู่แล้ว template จะต่อ "| QR Cute" ซ้ำ
    title: { absolute: item.title },
    description: item.metaDescription,
    alternates: { canonical: url, languages: { th: url, "x-default": url } },
    openGraph: {
      type: "article",
      url,
      title: item.title,
      description: item.metaDescription,
    },
  };
}

const DATE = new Intl.DateTimeFormat("th-TH", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export default async function VsPage({
  params,
}: PageProps<"/vs/[competitor]">) {
  const item = findComparison((await params).competitor);
  if (item === undefined) notFound();

  const trail = [
    { name: "หน้าแรก", path: "/" },
    { name: `เทียบกับ ${item.name}`, path: `/vs/${item.slug}` },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd nodes={[organizationSchema(), breadcrumbSchema(trail)]} />
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Breadcrumbs trail={trail} />
        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">
          {siteConfig.name} กับ {item.name} ต่างกันยังไง
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{item.lede}</p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-3 pr-4 font-medium">
                  เรื่อง
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  {siteConfig.name}
                </th>
                <th scope="col" className="py-3 font-medium">
                  {item.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {item.rows.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <th scope="row" className="py-4 pr-4 align-top font-medium">
                    {row.label}
                  </th>
                  <td className="py-4 pr-4 align-top">{row.us}</td>
                  <td className="py-4 align-top text-muted-foreground">
                    {row.them}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          ข้อมูลของ {item.name} มาจาก{" "}
          <a
            href={item.sourceUrl}
            rel="noopener nofollow"
            className="underline"
          >
            หน้าราคาทางการ
          </a>{" "}
          ตรวจเมื่อ {DATE.format(new Date(item.checkedAt))} อาจเปลี่ยนแปลงได้
          โปรดตรวจหน้าของเขาอีกครั้งก่อนตัดสินใจ
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <section className="rounded-lg border p-5">
            <h2 className="font-semibold">เลือก {item.name} ถ้า…</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {item.chooseThem.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border border-primary p-5">
            <h2 className="font-semibold">เลือก {siteConfig.name} ถ้า…</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {item.chooseUs.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/">ลองสร้าง QR ฟรี</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/check">ตรวจว่า QR ที่ใช้อยู่จะหมดอายุไหม</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
