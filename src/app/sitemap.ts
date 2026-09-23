import type { MetadataRoute } from "next";
import { LEGAL_DOCUMENTS } from "@/lib/legal";
import { TYPE_PAGE_LIST } from "@/lib/seo/type-pages";
import { USE_CASES } from "@/lib/seo/use-cases";
import { absoluteUrl } from "@/lib/site";

/**
 * sitemap.xml
 *
 * ⚠️ ต้องประกาศเฉพาะหน้าที่มีอยู่จริงเท่านั้น URL ที่ตอบ 404 ใน sitemap
 * ทำให้ Search Console ขึ้น error และลดความน่าเชื่อถือของ sitemap ทั้งไฟล์
 * จึงดึงรายการจากแหล่งเดียวกับที่หน้าเว็บใช้ ไม่พิมพ์รายการซ้ำที่นี่
 *
 * หน้า /blog /about ยังไม่ได้ทำ จึงยังไม่อยู่ในนี้
 * เพิ่มเมื่อหน้ามีจริงแล้วเท่านั้น
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/pricing"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...TYPE_PAGE_LIST.map((page) => ({
      url: absoluteUrl(`/qr/${page.slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      // cluster ลำดับ 2 ใน docs/seo.md — intent ชัดและแปลงเป็นผู้ใช้ได้ทันที
      priority: 0.9,
    })),
    ...USE_CASES.map((page) => ({
      url: absoluteUrl(`/use-case/${page.slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // หน้ากฎหมายไม่ได้ทำมาเพื่อติดอันดับ แต่ต้องถูก index เพราะผู้พิจารณา
    // ใบสมัคร payment gateway และผู้ใช้ต้องค้นเจอได้
    ...LEGAL_DOCUMENTS.map((doc) => ({
      url: absoluteUrl(`/${doc.slug}`),
      lastModified: new Date(doc.effectiveDate),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
