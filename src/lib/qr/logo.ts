import type { ErrorCorrectionLevel } from "./encode";

/**
 * โลโก้ตรงกลาง QR
 *
 * โลโก้บังจุดข้อมูล ซึ่งกินโควตาการกู้คืนข้อมูลที่ QR มีอยู่จำกัด
 * ถ้าปล่อยให้ใหญ่ตามใจ ผู้ใช้จะได้ QR ที่สแกนไม่ติดโดยไม่รู้ตัว
 * เพดานขนาดจึงผูกกับระดับความทนทาน และบังคับใช้เสมอ ห้ามข้าม
 */

export const LOGO_MAX_BYTES = 1_000_000;

/**
 * รับเฉพาะภาพ raster
 *
 * ไม่รับ SVG เพราะไฟล์ SVG ฝังสคริปต์และลิงก์ภายนอกได้ และเราต้องแปลงโลโก้
 * เป็นภาพอยู่แล้วตอนทำ PDF — การรับ raster อย่างเดียวจึงทั้งปลอดภัยกว่าและง่ายกว่า
 */
export const LOGO_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type QrLogo = {
  /** data URI ของภาพ */
  src: string;
  /** ความกว้างโลโก้เทียบกับความกว้างของ QR ส่วนที่เป็นข้อมูล (ไม่รวมขอบว่าง) */
  sizeRatio: number;
};

export const MIN_LOGO_RATIO = 0.08;

/**
 * ขนาดโลโก้ที่วัดแล้วว่า decode ไม่ผ่าน (ความกว้างเทียบกับ QR)
 *
 * วัดเมื่อ 6 ก.ย. 2026 ด้วยการ render จริงแล้ว decode กลับ ไล่ทีละ 1%
 * ตัวเลขนี้คือค่าแรกที่อ่านไม่ออก — เก็บไว้เพื่อให้เห็นว่าเพดานห่างจากขอบแค่ไหน
 *
 * ⚠️ เคยลองใช้สูตร √(recovery × 0.5) แล้วพบว่าให้ Q ที่ 35% ซึ่งอ่านไม่ออกจริง
 * สูตรสวย ๆ ใช้ไม่ได้กับเรื่องนี้ เพราะโลโก้ยังบัง alignment pattern ตรงกลางด้วย
 */
export const MEASURED_LOGO_FAILURE_RATIO: Record<ErrorCorrectionLevel, number> =
  {
    L: 0.18,
    M: 0.27,
    Q: 0.35,
    H: 0.41,
  };

/**
 * เพดานที่ปล่อยให้ผู้ใช้ตั้งได้ = ราว 70% ของขอบที่วัดได้
 *
 * เว้นระยะไว้สองเรื่อง: (1) ขอบขยับตามความยาวข้อมูล เพราะ QR เปลี่ยน version
 * (2) ต้องเหลือโควตากู้คืนไว้รับความเสียหายจริงตอนพิมพ์ด้วย — รอยเปื้อน รอยพับ หมึกซึม
 *
 * ยืนยันแล้วว่าทุกค่าในตารางนี้ decode ผ่านทั้ง URL สั้น, พร้อมเพย์ และ vCard ไทยยาว
 */
export const MAX_LOGO_RATIO: Record<ErrorCorrectionLevel, number> = {
  L: 0.12,
  M: 0.18,
  Q: 0.24,
  H: 0.28,
};

/** เพดานความกว้างของโลโก้ตามระดับความทนทานที่เลือกไว้ */
export function maxLogoRatio(level: ErrorCorrectionLevel): number {
  return MAX_LOGO_RATIO[level];
}

export function clampLogoRatio(
  ratio: number,
  level: ErrorCorrectionLevel,
): number {
  return Math.min(maxLogoRatio(level), Math.max(MIN_LOGO_RATIO, ratio));
}

/** โลโก้ที่ใหญ่เกินเพดานของระดับปัจจุบัน ต้องถูกย่อลงและบอกผู้ใช้ว่าทำไม */
export function logoWarning(
  logo: QrLogo | null,
  level: ErrorCorrectionLevel,
): string | null {
  if (logo === null) return null;

  if (level === "L" || level === "M") {
    return "โลโก้กินพื้นที่ที่ QR ใช้กู้ข้อมูล — ถ้าจะพิมพ์ไปใช้จริง ควรเลือก “ต้องทนที่สุด” ในแท็บข้อมูลก่อน";
  }

  return null;
}

/**
 * บังคับเพดานขนาดโลโก้ให้เข้ากับระดับความทนทานปัจจุบัน
 *
 * เก็บค่าที่ผู้ใช้ตั้งไว้เดิมใน state ไม่แตะ แล้วบีบเฉพาะตอนเอาไปใช้จริง
 * ถ้าผู้ใช้เปลี่ยนกลับไปใช้ระดับที่ทนขึ้น ขนาดเดิมจะกลับมาเองโดยไม่ต้องตั้งใหม่
 */
export function clampLogoForLevel<T extends { logo: QrLogo | null }>(
  style: T,
  level: ErrorCorrectionLevel,
): T {
  if (style.logo === null) return style;

  const clamped = clampLogoRatio(style.logo.sizeRatio, level);
  if (clamped === style.logo.sizeRatio) return style;

  return { ...style, logo: { ...style.logo, sizeRatio: clamped } };
}

export type LogoRaster = {
  /** ไบต์ของภาพ JPEG ในรูปเลขฐานสิบหก เพื่อให้ฝังใน PDF ที่เป็น ASCII ล้วนได้ */
  hex: string;
  widthPx: number;
  heightPx: number;
};

/** ขนาดที่แปลงโลโก้ลงก่อนฝังใน PDF — พอสำหรับงานพิมพ์โดยไม่ทำให้ไฟล์บวม */
const LOGO_RASTER_PX = 512;

/**
 * แปลงโลโก้เป็น JPEG เพื่อฝังลง PDF
 *
 * ใช้ JPEG เพราะ PDF ฝังไบต์ JPEG ได้ตรง ๆ ผ่าน DCTDecode ไม่ต้องบีบอัดเอง
 * JPEG ไม่มีพื้นโปร่ง จึงต้องวางบนสีพื้นของ QR ก่อน — ซึ่งตรงกับที่เห็นบนหน้าจอ
 * เพราะบนหน้าจอโลโก้ก็วางอยู่บนกรอบสีพื้นเหมือนกัน
 *
 * ใช้ได้เฉพาะฝั่ง browser
 */
export async function rasterizeLogoToJpeg(
  src: string,
  backgroundColor: string,
): Promise<LogoRaster> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("อ่านไฟล์โลโก้ไม่สำเร็จ"));
    image.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = LOGO_RASTER_PX;
  canvas.height = LOGO_RASTER_PX;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("เบราว์เซอร์นี้ไม่รองรับ canvas");

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, LOGO_RASTER_PX, LOGO_RASTER_PX);

  // คงสัดส่วนเดิมของโลโก้ แล้ววางกึ่งกลาง เหมือน preserveAspectRatio ของ SVG
  const scale = Math.min(
    LOGO_RASTER_PX / image.naturalWidth,
    LOGO_RASTER_PX / image.naturalHeight,
  );
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    (LOGO_RASTER_PX - drawWidth) / 2,
    (LOGO_RASTER_PX - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);

  let hex = "";
  for (let index = 0; index < binary.length; index += 1) {
    hex += binary.charCodeAt(index).toString(16).padStart(2, "0");
  }

  return { hex, widthPx: LOGO_RASTER_PX, heightPx: LOGO_RASTER_PX };
}

export type LogoFileError = "type" | "size";

export function validateLogoFile(file: File): LogoFileError | null {
  if (!(LOGO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "type";
  }
  if (file.size > LOGO_MAX_BYTES) return "size";
  return null;
}

export const LOGO_FILE_ERROR_MESSAGES: Record<LogoFileError, string> = {
  type: "รองรับเฉพาะไฟล์ PNG, JPEG และ WebP",
  size: `ไฟล์ใหญ่เกิน ${LOGO_MAX_BYTES / 1_000_000} MB`,
};
