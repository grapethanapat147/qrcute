import type { QrMatrix } from "./encode";
import { frameLayout } from "./frame";
import { MM_PER_INCH, PRINT_PRESETS } from "./print";
import { drawSignLines, PRINT_DPI } from "./raster";
import { renderSvg, type SvgRenderOptions } from "./render-svg";
import {
  type PaymentSign,
  signFooterLines,
  signHeaderLines,
  signLayout,
} from "./sign";
import { DEFAULT_QR_STYLE } from "./style";

export const PNG_SIZES = [512, 1024, 2048] as const;
export type PngSize = (typeof PNG_SIZES)[number];

/** แปลง SVG string เป็น data URI ที่ใช้เป็น src ของ <img> ได้ */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * ปัดความกว้างให้หารด้วยจำนวน module ลงตัว
 *
 * ถ้าขอบ module ตกคร่อม pixel ภาพจะเบลอ ซึ่งเป็นสาเหตุอันดับต้น ๆ
 * ที่ QR พิมพ์ออกมาแล้วสแกนไม่ติด — ยอมให้ภาพเล็กกว่าที่ขอเล็กน้อยดีกว่า
 */
export function snapSizeToModules(
  moduleCount: number,
  targetSize: number,
): number {
  const modulePixels = Math.max(1, Math.floor(targetSize / moduleCount));
  return modulePixels * moduleCount;
}

export type PngRenderOptions = SvgRenderOptions & { size: number };

/**
 * แปลง matrix เป็น PNG โดย rasterize SVG ตัวเดียวกับที่แสดง preview และที่ดาวน์โหลดเป็น SVG
 *
 * ทำแบบนี้เพื่อไม่ให้มี renderer สองชุดที่ค่อย ๆ เพี้ยนจากกัน — รูปทรงจุด
 * รูปทรงตามุม gradient โลโก้ และแถบข้อความจะออกมาเหมือนกันทุกฟอร์แมตโดยอัตโนมัติ
 * ใช้ได้เฉพาะฝั่ง browser
 */
export async function renderPngBlob(
  matrix: QrMatrix,
  options: PngRenderOptions,
): Promise<Blob> {
  const style = options.style ?? DEFAULT_QR_STYLE;
  const frame = frameLayout(matrix.size, style.frame);

  const width = snapSizeToModules(frame.width, options.size);
  const height = Math.round((width * frame.height) / frame.width);
  const svg = renderSvg(matrix, { ...options, size: width });

  const image = new Image();
  image.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("แปลง SVG เป็นภาพไม่สำเร็จ"));
    image.src = svgToDataUri(svg);
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("เบราว์เซอร์นี้ไม่รองรับ canvas 2d context");
  }
  context.drawImage(image, 0, 0, width, height);

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

/** ป้าย PNG ใช้สัดส่วนป้ายตั้งโต๊ะ A6 ที่ 300 dpi — พิมพ์เองที่บ้านแล้วได้ขนาดจริง */
const SIGN_PAGE = PRINT_PRESETS.find((preset) => preset.id === "tent-a6");

/**
 * ป้ายรับเงินทั้งแผ่นเป็น PNG — วาง QR ที่ render แล้วลงไปแบบ 1:1 ไม่ย่อขยาย
 * เพื่อให้ขอบ module ยังตรง pixel เหมือน PNG ปกติที่ผ่านการทดสอบสแกนแล้ว
 * ใช้ได้เฉพาะฝั่ง browser
 */
export async function renderSignPngBlob(
  matrix: QrMatrix,
  options: SvgRenderOptions & { sign: PaymentSign },
): Promise<Blob> {
  if (SIGN_PAGE === undefined) throw new Error("ไม่พบขนาดป้าย A6");
  const pxPerMm = PRINT_DPI / MM_PER_INCH;
  const pageWidth = Math.round(SIGN_PAGE.pageWidthMm * pxPerMm);
  const pageHeight = Math.round(SIGN_PAGE.pageHeightMm * pxPerMm);

  const block = await createImageBitmap(
    await renderPngBlob(matrix, {
      ...options,
      size: Math.round(SIGN_PAGE.qrSizeMm * pxPerMm),
    }),
  );
  const layout = signLayout(pageWidth, pageHeight, block.width, block.height);

  const canvas = document.createElement("canvas");
  canvas.width = pageWidth;
  canvas.height = pageHeight;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("เบราว์เซอร์นี้ไม่รองรับ canvas 2d context");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, pageWidth, pageHeight);
  context.drawImage(
    block,
    Math.round(layout.blockX),
    Math.round(layout.blockY),
  );

  const header = signHeaderLines(options.sign);
  const footer = signFooterLines(options.sign);
  if (layout.header !== null && header.length > 0) {
    await drawSignLines(context, header, layout.header);
  }
  if (layout.footer !== null && footer.length > 0) {
    await drawSignLines(context, footer, layout.footer);
  }

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
