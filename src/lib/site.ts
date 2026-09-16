/**
 * ค่ากลางของเว็บ — ทุกที่ที่ต้องใช้ชื่อแบรนด์/โดเมนต้องอ่านจากไฟล์นี้
 * ห้าม hardcode โดเมนใน metadata, sitemap, JSON-LD หรือ og:image
 * ดู docs/decisions/0002-brand-placeholder.md
 *
 * ชื่อแบรนด์ล็อกแล้วเป็น "QR Cute" (14 ก.ย. 2026) แต่โดเมนยังไม่ได้ซื้อ
 * `url` จึงยังเป็น placeholder อยู่ — มี assertUrlConfigured() คอยกันไม่ให้หลุดขึ้น production
 */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "QR Cute",
  shortName: process.env.NEXT_PUBLIC_SITE_SHORT_NAME ?? "QRCute",
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

/**
 * กันไม่ให้โดเมน placeholder หลุดขึ้น production
 *
 * ADR 0002 ระบุข้อเสียของวิธี env ไว้ตรง ๆ ว่า "ชื่อ placeholder อาจหลุดขึ้น production
 * ถ้าลืมตั้ง env" ซึ่งพังแบบเงียบที่สุด: canonical, sitemap และ JSON-LD จะชี้ไป
 * localhost ทั้งหมด Google เก็บ index ไม่ได้ และไม่มี error ให้ใครเห็น
 *
 * เช็คด้วย VERCEL_ENV ไม่ใช่ NODE_ENV เพราะ `bun run build` ในเครื่องก็เป็น production
 * แต่ยังไม่ได้ตั้งโดเมน — ถ้าใช้ NODE_ENV จะ build ในเครื่องไม่ได้เลย
 */
export function assertUrlConfigured(): void {
  if (process.env.VERCEL_ENV !== "production") return;

  if (siteConfig.url.includes("localhost")) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL ยังเป็น localhost บน production — ตั้งโดเมนจริงก่อน deploy",
    );
  }
}
