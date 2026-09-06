import { type PromptPayTargetType, validatePromptPay } from "./promptpay";

/**
 * ประเภท QR ที่รองรับ
 *
 * เก็บเฉพาะประเภทที่มีทั้ง keyword cluster ใน docs/seo.md และ use case
 * ใน docs/strategy.md — ประเภทที่ไม่มีทั้งสองอย่าง (ข้อความ, โทร, SMS, อีเมล)
 * ถูกตัดออกเมื่อ 6 ก.ย. 2026 เพราะกินพื้นที่บน hero โดยไม่สร้าง traffic หรือรายได้
 * ถ้าจะเพิ่มกลับ ต้องมีเหตุผลจากข้อมูล ไม่ใช่เพราะ "คู่แข่งมี"
 */
export const QR_TYPES = ["promptpay", "url", "wifi", "line", "vcard"] as const;

export type QrType = (typeof QR_TYPES)[number];

export type WifiEncryption = "WPA" | "WEP" | "nopass";

/**
 * ข้อมูลที่ผู้ใช้กรอก — เป็น discriminated union เพื่อให้ TypeScript
 * บังคับให้จัดการครบทุกประเภทเวลา switch (คู่กับ noFallthroughCasesInSwitch)
 */
export type QrData =
  | {
      type: "promptpay";
      targetType: PromptPayTargetType;
      target: string;
      /** เก็บเป็นข้อความเพราะมาจาก input โดยตรง — แปลงเป็นตัวเลขตอน build */
      amount: string;
    }
  | { type: "url"; url: string }
  | {
      type: "wifi";
      ssid: string;
      password: string;
      encryption: WifiEncryption;
      hidden: boolean;
    }
  | { type: "line"; officialAccountId: string }
  | {
      type: "vcard";
      firstName: string;
      lastName: string;
      organization: string;
      title: string;
      phone: string;
      email: string;
      website: string;
    };

export type QrDataOf<T extends QrType> = Extract<QrData, { type: T }>;

export function isQrType(value: string): value is QrType {
  return (QR_TYPES as readonly string[]).includes(value);
}

export const QR_TYPE_LABELS: Record<QrType, string> = {
  promptpay: "พร้อมเพย์",
  url: "ลิงก์เว็บไซต์",
  wifi: "WiFi",
  line: "LINE",
  vcard: "นามบัตร",
};

export const QR_TYPE_DESCRIPTIONS: Record<QrType, string> = {
  promptpay: "สแกนด้วยแอปธนาคารแล้วโอนเงินเข้าบัญชีพร้อมเพย์ที่ระบุ",
  url: "สแกนแล้วเปิดเว็บไซต์ที่ระบุ เช่น เมนูอาหารหรือเพจร้าน",
  wifi: "สแกนแล้วเชื่อมต่อ WiFi อัตโนมัติ ไม่ต้องพิมพ์รหัส",
  line: "สแกนแล้วเปิดโปรไฟล์ LINE Official Account",
  vcard: "สแกนแล้วบันทึกรายชื่อลงสมุดโทรศัพท์",
};

/** ค่าเริ่มต้นของแต่ละประเภท ใช้ตอนผู้ใช้สลับประเภท */
export function emptyQrData(type: QrType): QrData {
  switch (type) {
    case "promptpay":
      return {
        type: "promptpay",
        targetType: "mobile",
        target: "",
        amount: "",
      };
    case "url":
      return { type: "url", url: "" };
    case "wifi":
      return {
        type: "wifi",
        ssid: "",
        password: "",
        encryption: "WPA",
        hidden: false,
      };
    case "line":
      return { type: "line", officialAccountId: "" };
    case "vcard":
      return {
        type: "vcard",
        firstName: "",
        lastName: "",
        organization: "",
        title: "",
        phone: "",
        email: "",
        website: "",
      };
  }
}

/**
 * ตรวจความถูกต้องก่อนสร้าง QR — คืนข้อความ error ภาษาไทย หรือ null ถ้าผ่าน
 *
 * ประเภทอื่นไม่บล็อกเพราะ payload ผิดรูปแบบก็แค่สแกนแล้วไม่ได้ผลตามคาด
 * แต่พร้อมเพย์ที่ผิดหมายถึงเงินอาจเข้าผิดบัญชี — ต้องบล็อกไม่ให้แสดง QR เลย
 */
export function validateQrData(data: QrData): string | null {
  return data.type === "promptpay" ? validatePromptPay(data) : null;
}

/** ประเภทนี้กรอกครบพอที่จะสร้าง QR ได้หรือยัง */
export function isQrDataComplete(data: QrData): boolean {
  switch (data.type) {
    case "promptpay":
      return data.target.trim().length > 0;
    case "url":
      return data.url.trim().length > 0;
    case "wifi":
      return data.ssid.trim().length > 0;
    case "line":
      return data.officialAccountId.trim().length > 0;
    case "vcard":
      return (
        data.firstName.trim().length > 0 || data.lastName.trim().length > 0
      );
  }
}
