import type { ErrorCorrectionLevel } from "./encode";
import type { QrStyle } from "./style";
import type { QrData } from "./types";

/**
 * QR ที่ผู้ใช้สร้างไว้ตอนยังไม่ล็อกอิน
 *
 * เก็บไว้ในเครื่องผู้ใช้เท่านั้น ไม่ส่งขึ้น server ก่อนที่ผู้ใช้จะสมัครและกดยืนยัน
 * ซึ่งทั้งง่ายกว่าการมีตาราง draft ฝั่ง server และดีกว่าในแง่ PDPA
 */

export const DRAFT_STORAGE_KEY = "qr-drafts-v1";

/** กันไม่ให้ draft กิน localStorage จนเต็มโควตาของ origin */
export const MAX_DRAFTS = 10;

export type QrDraft = {
  id: string;
  title: string;
  data: QrData;
  style: QrStyle;
  level: ErrorCorrectionLevel;
  createdAt: string;
};

/** ที่เก็บข้อมูลแบบ localStorage — แยกออกมาเพื่อให้ทดสอบได้โดยไม่ต้องมีเบราว์เซอร์ */
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * ตัดโลโก้ออกก่อนเก็บเสมอ
 *
 * โลโก้เป็น data URI ที่ใหญ่ได้ถึง 1 MB ซึ่งทั้งกินโควตา localStorage
 * และทำให้แถวใน database บวมถ้าเก็บตามขึ้นไป
 * ⚠️ เก็บโลโก้ได้เมื่อย้ายไป Supabase Storage แล้ว (TODO ใน ADR 0004)
 */
export function stripLogo(style: QrStyle): QrStyle {
  return style.logo === null ? style : { ...style, logo: null };
}

export function readDrafts(storage: DraftStorage): QrDraft[] {
  try {
    const raw = storage.getItem(DRAFT_STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isDraft);
  } catch {
    // ข้อมูลเสียหรือ localStorage ถูกปิด — ถือว่าไม่มี draft ดีกว่าทำหน้าพัง
    return [];
  }
}

function isDraft(value: unknown): value is QrDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Partial<QrDraft>;
  return (
    typeof draft.id === "string" &&
    typeof draft.createdAt === "string" &&
    typeof draft.data === "object" &&
    draft.data !== null
  );
}

/** เพิ่ม draft ใหม่ไว้บนสุด และตัดของเก่าที่เกินโควตาทิ้ง */
export function addDraft(storage: DraftStorage, draft: QrDraft): QrDraft[] {
  const next = [draft, ...readDrafts(storage)].slice(0, MAX_DRAFTS);

  try {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // เต็มโควตาหรือโหมดส่วนตัว — ไม่ต้องทำอะไร ผู้ใช้ยังดาวน์โหลดไฟล์ได้ตามปกติ
  }

  return next;
}

export function clearDrafts(storage: DraftStorage): void {
  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // เงียบไว้ ไม่มีอะไรให้ผู้ใช้ทำต่อได้อยู่ดี
  }
}

/** ชื่อตั้งต้นให้ผู้ใช้ไม่ต้องคิดเอง */
export function suggestTitle(data: QrData): string {
  switch (data.type) {
    case "promptpay":
      return `พร้อมเพย์ ${data.target}`.trim();
    case "url":
      return data.url.replace(/^https?:\/\//, "").slice(0, 60);
    case "wifi":
      return `WiFi ${data.ssid}`.trim();
    case "line":
      return `LINE ${data.officialAccountId}`.trim();
    case "vcard":
      return `${data.firstName} ${data.lastName}`.trim();
  }
}
