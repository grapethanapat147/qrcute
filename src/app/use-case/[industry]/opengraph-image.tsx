import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { findUseCase, USE_CASES } from "@/lib/seo/use-cases";
import { siteConfig } from "@/lib/site";

export const alt = "QR Code แยกตามประเภทธุรกิจ";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return USE_CASES.map((page) => ({ industry: page.slug }));
}

/**
 * ⚠️ params ของ Next 16 เป็น Promise ต้อง await ก่อนเสมอ
 * ถ้าอ่าน property ตรง ๆ จะได้ undefined เงียบ ๆ แล้วทุกหน้าจะตกไปใช้ชื่อสำรอง
 * โดยไม่มี error ให้เห็น — เจอตอนเปิดไฟล์ PNG ที่ render ออกมาดูจริง
 */
export default async function Image({
  params,
}: {
  params: Promise<{ industry: string }>;
}) {
  const { industry } = await params;
  const page = findUseCase(industry);

  return renderOgImage({
    title: page?.h1 ?? "QR Code สำหรับธุรกิจ",
    brand: siteConfig.name,
    domain: new URL(siteConfig.url).host,
  });
}
