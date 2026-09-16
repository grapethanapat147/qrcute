import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * robots.txt
 *
 * ปิดเส้นทางที่ไม่มีประโยชน์ต่อการค้นหาและไม่ควรถูกเก็บ index:
 * - /r/ คือปลายทาง redirect ของ dynamic QR ไม่ใช่หน้าเว็บ และเป็นของผู้ใช้แต่ละคน
 * - /dashboard /login /auth ต้องล็อกอินอยู่แล้ว bot เข้าไปก็เจอแต่หน้าเปล่า
 * - /api ไม่ใช่หน้าเว็บเลย
 *
 * ⚠️ robots.txt ไม่ใช่ระบบความปลอดภัย มันแค่ขอความร่วมมือจาก bot ที่สุภาพ
 * การกันข้อมูลจริงยังต้องพึ่ง RLS กับการตรวจสิทธิ์ในโค้ดเหมือนเดิม
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/login", "/auth/", "/r/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
