import { ImageResponse } from "next/og";
import { loadThaiFont } from "./og-font";

/**
 * ภาพประกอบตอนแชร์ลิงก์ (og:image)
 *
 * ขนาด 1200×630 เป็นมาตรฐานที่ทุกแพลตฟอร์มรองรับ
 * ออกแบบให้อ่านออกตอนย่อเล็กใน LINE และ Facebook: ตัวอักษรใหญ่ คอนทราสต์สูง
 * ไม่ใส่รายละเอียดเล็ก ๆ ที่หายไปตอนย่อ
 *
 * ถ้าโหลดฟอนต์ไทยไม่ได้ จะเรนเดอร์เฉพาะชื่อแบรนด์กับโดเมนซึ่งเป็นอักษรละติน
 * ดีกว่าปล่อยให้ข้อความไทยกลายเป็นกล่องสี่เหลี่ยม
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export async function renderOgImage(input: {
  title: string;
  brand: string;
  domain: string;
}): Promise<ImageResponse> {
  const font = await loadThaiFont(
    `${input.title}${input.brand}${input.domain}QR`,
  );
  const canRenderThai = font !== null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0b0f16",
        color: "#f7f7f5",
        padding: 72,
        fontFamily: canRenderThai ? "Noto Sans Thai" : "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "#f7f7f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0b0f16",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          QR
        </div>
        <div style={{ fontSize: 34, fontWeight: 700 }}>{input.brand}</div>
      </div>

      {canRenderThai ? (
        <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.35 }}>
          {input.title}
        </div>
      ) : (
        <div style={{ fontSize: 66, fontWeight: 700 }}>{input.brand}</div>
      )}

      <div style={{ fontSize: 30, color: "#9aa3b2" }}>{input.domain}</div>
    </div>,
    {
      ...OG_SIZE,
      fonts:
        font === null
          ? []
          : [
              {
                name: "Noto Sans Thai",
                data: font,
                weight: 700,
                style: "normal",
              },
            ],
    },
  );
}
