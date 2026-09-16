import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name} — สร้าง QR Code ฟรี ไม่มีวันหมดอายุ`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** ภาพเริ่มต้นของทั้งเว็บ หน้าไหนไม่มีของตัวเองจะใช้อันนี้ */
export default async function Image() {
  return renderOgImage({
    title: "สร้าง QR Code ฟรี ไม่มีวันหมดอายุ",
    brand: siteConfig.name,
    domain: new URL(siteConfig.url).host,
  });
}
