import { Clock, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidShortcode } from "@/lib/dynamic/shortcode";
import { readShopLinks } from "@/lib/shop/page";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/**
 * หน้าร้านสาธารณะ — คนที่เห็นคือลูกค้าของลูกค้าเราที่สแกนป้ายหน้าร้าน
 *
 * noindex: เนื้อหาเป็นของผู้ใช้ ไม่ใช่ของเรา ถ้าให้ Google เก็บ หน้าที่ถูกใช้ทำ spam
 * หรือ phishing จะไปดึงคะแนนความน่าเชื่อถือของโดเมนทั้งเว็บลง
 * ลิงก์ทุกอันเป็น nofollow ugc ด้วยเหตุผลเดียวกัน
 *
 * shortcut: ยังแสดงหน้าต่อแม้เจ้าของหยุดจ่าย (แก้ไม่ได้อย่างเดียว), ผูกกับลำดับเวลา ADR 0008 ถ้ามีคนใช้ช่องนี้หน้าร้านฟรี
 */

/** 0812345678 → 081-234-5678 ให้คนอ่านง่าย เบอร์รูปแบบอื่นแสดงตามที่กรอก */
function displayPhone(phone: string): string {
  return phone.replace(/^(0\d{2})(\d{3})(\d{4})$/, "$1-$2-$3");
}

async function loadPage(slug: string) {
  if (!isValidShortcode(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("shop_page_by_slug", { p_slug: slug });
  return data?.[0] ?? null;
}

export async function generateMetadata({
  params,
}: PageProps<"/s/[slug]">): Promise<Metadata> {
  const page = await loadPage((await params).slug);
  return page === null
    ? {}
    : {
        title: { absolute: page.name },
        robots: { index: false, follow: false },
      };
}

export default async function ShopPage({ params }: PageProps<"/s/[slug]">) {
  const page = await loadPage((await params).slug);
  if (page === null) notFound();
  const links = readShopLinks(page.links);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-12"
    >
      <h1 className="text-center text-3xl font-bold">{page.name}</h1>
      {page.description !== "" && (
        <p className="mt-3 whitespace-pre-line text-center text-muted-foreground">
          {page.description}
        </p>
      )}

      <ul className="mt-8 space-y-3">
        {links.map((link) => (
          <li key={link.url}>
            <a
              href={link.url}
              rel="noopener nofollow ugc"
              className="block rounded-xl border-2 border-foreground px-5 py-4 text-center font-medium hover:bg-muted"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-8 space-y-2 text-center text-sm text-muted-foreground">
        {page.phone !== "" && (
          <a
            href={`tel:${page.phone}`}
            className="flex items-center justify-center gap-2 hover:text-foreground"
          >
            <Phone className="size-4" aria-hidden />
            {displayPhone(page.phone)}
          </a>
        )}
        {page.hours !== "" && (
          <p className="flex items-center justify-center gap-2">
            <Clock className="size-4" aria-hidden />
            {page.hours}
          </p>
        )}
      </div>

      <Link
        href="/"
        className="mt-auto pt-12 text-center text-xs text-muted-foreground hover:text-foreground"
      >
        ทำหน้าแบบนี้ด้วย {siteConfig.name}
      </Link>
    </main>
  );
}
