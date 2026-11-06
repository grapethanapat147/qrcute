import { verifyPromptPayChecksum } from "./promptpay";

/**
 * ตรวจว่า QR ที่ผู้ใช้มีอยู่จะ "ตาย" ได้ไหมถ้าเลิกจ่ายเงินให้บริการที่สร้างมัน
 *
 * คำบ่นอันดับหนึ่งของตลาด QR ทั่วโลกคือ QR ที่คิดว่าฟรีหยุดทำงานหลังพิมพ์ไปแล้ว
 * เพราะจริง ๆ มันเก็บลิงก์ของบริการนั้น ไม่ใช่ข้อมูลจริง เครื่องมือนี้แยกสองแบบออกจากกัน
 *
 * ทำงานจากข้อความที่ถอดได้เท่านั้น ไม่ยิงเน็ตไปตามลิงก์ — เราจึงบอกได้ว่าลิงก์ชี้ไปที่โฮสต์ไหน
 * แต่ไม่รู้ว่าโฮสต์นั้นพาต่อไปที่ใด
 * shortcut: รู้จักบริการ redirect แค่รายชื่อด้านล่าง, เปลี่ยนเป็นตามลิงก์จริงฝั่งเซิร์ฟเวอร์ (ต้องกัน SSRF) ถ้าผู้ใช้ต้องการคำตอบที่แน่นอนกว่านี้
 */

/** โฮสต์ที่รู้แน่ว่าเป็นบริการย่อลิงก์หรือ QR แบบวิ่งผ่าน — ใส่เฉพาะที่ยืนยันได้ ห้ามเดา */
export const KNOWN_REDIRECT_HOSTS = [
  "bit.ly",
  "tinyurl.com",
  "qrco.de",
  "flowcode.com",
  "qr.codes",
];

export type QrCheckResult =
  | { kind: "embedded"; label: string }
  | { kind: "ours"; host: string }
  | { kind: "redirect-service"; host: string }
  | { kind: "link"; host: string }
  | { kind: "empty" };

function embeddedLabel(text: string): string | null {
  if (text.startsWith("000201") && verifyPromptPayChecksum(text)) {
    return "QR รับเงินพร้อมเพย์";
  }
  const upper = text.toUpperCase();
  if (upper.startsWith("WIFI:")) return "QR WiFi";
  if (upper.startsWith("BEGIN:VCARD") || upper.startsWith("MECARD:")) {
    return "QR นามบัตร";
  }
  if (/^(TEL|SMSTO|SMS|MAILTO|GEO):/i.test(text)) return "QR ข้อมูลติดต่อ";
  return null;
}

function hostOf(text: string): string | null {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.host.toLowerCase().replace(/^www\./, "")
      : null;
  } catch {
    return null;
  }
}

export function checkQr(rawText: string, ownHost: string): QrCheckResult {
  const text = rawText.trim();
  if (text === "") return { kind: "empty" };

  const embedded = embeddedLabel(text);
  if (embedded !== null) return { kind: "embedded", label: embedded };

  const host = hostOf(text);
  if (host === null) return { kind: "embedded", label: "QR ข้อความ" };

  if (host === ownHost.toLowerCase().replace(/^www\./, "")) {
    return { kind: "ours", host };
  }
  const isRedirect = KNOWN_REDIRECT_HOSTS.some(
    (known) => host === known || host.endsWith(`.${known}`),
  );
  return isRedirect
    ? { kind: "redirect-service", host }
    : { kind: "link", host };
}
