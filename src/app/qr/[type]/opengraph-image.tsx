import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { findTypePage, TYPE_PAGE_LIST } from "@/lib/seo/type-pages";
import { siteConfig } from "@/lib/site";

export const alt = "สร้าง QR Code แยกตามประเภท";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return TYPE_PAGE_LIST.map((page) => ({ type: page.slug }));
}

/**
 * ภาพเฉพาะของแต่ละหน้า ใช้ h1 ของหน้านั้นเป็นข้อความ
 * ทำให้ตอนแชร์ในไลน์หรือเฟซบุ๊กเห็นได้ทันทีว่าเป็นหน้าเรื่องอะไร
 */
/**
 * ⚠️ params ของ Next 16 เป็น Promise ต้อง await ก่อนเสมอ
 * ถ้าอ่าน property ตรง ๆ จะได้ undefined เงียบ ๆ แล้วทุกหน้าจะตกไปใช้ชื่อสำรอง
 * โดยไม่มี error ให้เห็น — เจอตอนเปิดไฟล์ PNG ที่ render ออกมาดูจริง
 */
export default async function Image({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const page = findTypePage(type);

  return renderOgImage({
    title: page?.h1 ?? "สร้าง QR Code ฟรี",
    brand: siteConfig.name,
    domain: new URL(siteConfig.url).host,
  });
}
