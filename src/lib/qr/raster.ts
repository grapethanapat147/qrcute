import { fitCtaText, type QrFrame } from "./frame";
import type { Box, SignLine } from "./sign";

/**
 * วาดแถบข้อความ CTA ด้วย canvas ของเบราว์เซอร์
 *
 * ให้เบราว์เซอร์เป็นคนจัดวางตัวอักษรไทย เพราะมัน shaping ได้ถูกต้อง
 * (วรรณยุกต์เหนือสระ สระเลื่อนตามรูปพยัญชนะ) แล้วเราเก็บผลลัพธ์เป็นภาพ
 * ภาพเดียวนี้ถูกใช้ทั้งบนหน้าจอ ใน SVG ใน PNG และใน PDF จึงเหมือนกันทุกที่
 *
 * ใช้ได้เฉพาะฝั่ง browser
 */

export type RasterImage = {
  /** data URI แบบ JPEG — ทึบแสงอยู่แล้วเพราะมีสีพื้นของแถบ */
  dataUrl: string;
  widthPx: number;
  heightPx: number;
};

/** ความละเอียดของแถบตอนแสดงผลบนหน้าจอและตอนทำ PNG */
export const BAND_PREVIEW_PIXELS_PER_MODULE = 48;

function resolveThaiFontFamily(): string {
  const fromToken = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-thai-sans")
    .trim();
  return fromToken === "" ? "sans-serif" : `${fromToken}, sans-serif`;
}

export async function rasterizeCtaBand(
  frame: QrFrame,
  widthModules: number,
  heightModules: number,
  pixelsPerModule: number,
): Promise<RasterImage | null> {
  if (frame.kind === "none" || frame.text.trim() === "") return null;

  // รอให้ฟอนต์ไทยโหลดเสร็จก่อน ไม่งั้น canvas จะวาดด้วยฟอนต์สำรองแล้วหน้าตาเพี้ยน
  await document.fonts.ready;

  const widthPx = Math.round(widthModules * pixelsPerModule);
  const heightPx = Math.round(heightModules * pixelsPerModule);

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("เบราว์เซอร์นี้ไม่รองรับ canvas");

  context.fillStyle = frame.background;
  context.fillRect(0, 0, widthPx, heightPx);

  const fontFamily = resolveThaiFontFamily();
  const padding = widthPx * 0.06;
  const boxWidth = widthPx - padding * 2;

  const fitted = fitCtaText(frame.text, boxWidth, heightPx, (text, size) => {
    context.font = `600 ${size}px ${fontFamily}`;
    return context.measureText(text).width;
  });

  context.fillStyle = frame.textColor;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `600 ${fitted.fontSizePx}px ${fontFamily}`;

  // เผื่อระยะบรรทัดให้พอสำหรับสระบนและวรรณยุกต์ ไม่งั้นสองบรรทัดจะชนกัน
  const lineHeight = fitted.fontSizePx * 1.45;
  const totalHeight = lineHeight * fitted.lines.length;
  const firstBaseline = heightPx / 2 - totalHeight / 2 + lineHeight / 2;

  fitted.lines.forEach((line, index) => {
    context.fillText(line, widthPx / 2, firstBaseline + index * lineHeight);
  });

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.95),
    widthPx,
    heightPx,
  };
}

/**
 * วาดข้อความของป้ายลงในกล่อง — แบ่งความสูงให้บรรทัดละเท่ากัน แล้วย่อแต่ละบรรทัดให้พอดีกว้าง
 * ใช้ทั้งตอนวาดป้าย PNG ทั้งแผ่น และตอนทำภาพข้อความไปฝังใน PDF
 */
export async function drawSignLines(
  context: CanvasRenderingContext2D,
  lines: SignLine[],
  box: Box,
): Promise<void> {
  await document.fonts.ready;
  const fontFamily = resolveThaiFontFamily();
  const rowHeight = box.height / lines.length;

  lines.forEach((line, row) => {
    const font = (size: number) => `${line.weight} ${size}px ${fontFamily}`;
    const fitted = fitCtaText(line.text, box.width, rowHeight, (text, size) => {
      context.font = font(size);
      return context.measureText(text).width;
    });
    context.fillStyle = line.color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = font(fitted.fontSizePx);

    const lineHeight = fitted.fontSizePx * 1.45;
    const top = box.y + row * rowHeight;
    const first =
      top +
      rowHeight / 2 -
      (lineHeight * fitted.lines.length) / 2 +
      lineHeight / 2;
    fitted.lines.forEach((text, index) => {
      context.fillText(text, box.x + box.width / 2, first + index * lineHeight);
    });
  });
}

/** ภาพข้อความพื้นขาวสำหรับฝังใน PDF */
export async function rasterizeSignLines(
  lines: SignLine[],
  widthPx: number,
  heightPx: number,
): Promise<RasterImage | null> {
  if (lines.length === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("เบราว์เซอร์นี้ไม่รองรับ canvas");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, widthPx, heightPx);
  await drawSignLines(context, lines, {
    x: 0,
    y: 0,
    width: widthPx,
    height: heightPx,
  });
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.95),
    widthPx,
    heightPx,
  };
}

/** ความละเอียดงานพิมพ์ที่ใช้กันเป็นมาตรฐาน */
export const PRINT_DPI = 300;

/**
 * กี่พิกเซลต่อหนึ่ง module เมื่อพิมพ์ที่ขนาดจริง
 * คิดจาก 300 dpi เพื่อให้ตัวอักษรบนแถบคมพอสำหรับงานพิมพ์
 */
export function printPixelsPerModule(
  blockWidthMm: number,
  blockWidthModules: number,
): number {
  const mmPerModule = blockWidthMm / blockWidthModules;
  return Math.max(8, Math.round((mmPerModule / 25.4) * PRINT_DPI));
}

/** แปลง data URI เป็นไบต์ในรูปเลขฐานสิบหก สำหรับฝังใน PDF */
export function dataUrlToHex(dataUrl: string): string {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  let hex = "";
  for (let index = 0; index < binary.length; index += 1) {
    hex += binary.charCodeAt(index).toString(16).padStart(2, "0");
  }
  return hex;
}
