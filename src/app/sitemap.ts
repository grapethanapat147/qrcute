import type { MetadataRoute } from "next";
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
 * หน้า /pricing /blog /about ยังไม่ได้ทำ จึงยังไม่อยู่ในนี้
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
  ];
}
