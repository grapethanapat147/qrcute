/**
 * ค่ากลางของเว็บ — ทุกที่ที่ต้องใช้ชื่อแบรนด์/โดเมนต้องอ่านจากไฟล์นี้
 * ห้าม hardcode โดเมนใน metadata, sitemap, JSON-LD หรือ og:image
 * เพราะชื่อแบรนด์ยังไม่ล็อก (ดู docs/decisions/0002-brand-placeholder.md)
 */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "QR ไทย",
  shortName: process.env.NEXT_PUBLIC_SITE_SHORT_NAME ?? "QRThai",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "สร้าง QR Code ฟรี ไม่มีวันหมดอายุ รองรับพร้อมเพย์ WiFi นามบัตร LINE และดาวน์โหลดไฟล์คุณภาพสำหรับงานพิมพ์",
  locale: "th-TH",
  defaultLanguage: "th",
  supportedLanguages: ["th", "en"] as const,
} as const;

export type SupportedLanguage = (typeof siteConfig.supportedLanguages)[number];

export function absoluteUrl(path = "/"): string {
  return new URL(path, siteConfig.url).toString();
}
