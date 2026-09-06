import type { QrMatrix } from "./encode";
import { renderSvg, type SvgRenderOptions } from "./render-svg";

export const PNG_SIZES = [512, 1024, 2048] as const;
export type PngSize = (typeof PNG_SIZES)[number];

/** แปลง SVG string เป็น data URI ที่ใช้เป็น src ของ <img> ได้ */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * ปัดขนาดภาพให้หารด้วยจำนวน module ลงตัว
 *
 * ถ้าขอบ module ตกคร่อม pixel ภาพจะเบลอ ซึ่งเป็นสาเหตุอันดับต้น ๆ
 * ที่ QR พิมพ์ออกมาแล้วสแกนไม่ติด — ยอมให้ภาพเล็กกว่าที่ขอเล็กน้อยดีกว่า
 */
export function snapSizeToModules(
  matrixSize: number,
  targetSize: number,
): number {
  const modulePixels = Math.max(1, Math.floor(targetSize / matrixSize));
  return modulePixels * matrixSize;
}

export type PngRenderOptions = SvgRenderOptions & { size: number };

/**
 * แปลง matrix เป็น PNG โดย rasterize SVG ตัวเดียวกับที่แสดง preview และที่ดาวน์โหลดเป็น SVG
 *
 * ทำแบบนี้เพื่อไม่ให้มี renderer สองชุดที่ค่อย ๆ เพี้ยนจากกัน — รูปทรงจุด
 * รูปทรงตามุม และ gradient จะออกมาเหมือนกันทุกฟอร์แมตโดยอัตโนมัติ
 * ใช้ได้เฉพาะฝั่ง browser
 */
export async function renderPngBlob(
  matrix: QrMatrix,
  options: PngRenderOptions,
): Promise<Blob> {
  const canvasSize = snapSizeToModules(matrix.size, options.size);
  const svg = renderSvg(matrix, { ...options, size: canvasSize });

  const image = new Image();
  image.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("แปลง SVG เป็นภาพไม่สำเร็จ"));
    image.src = svgToDataUri(svg);
  });

  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("เบราว์เซอร์นี้ไม่รองรับ canvas 2d context");
  }
  context.drawImage(image, 0, 0, canvasSize, canvasSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error("แปลง canvas เป็น PNG ไม่สำเร็จ"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
