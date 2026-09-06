export const QR_TYPES = [
  "url",
  "text",
  "wifi",
  "vcard",
  "tel",
  "sms",
  "email",
  "line",
] as const;

export type QrType = (typeof QR_TYPES)[number];

export type WifiEncryption = "WPA" | "WEP" | "nopass";

/**
 * ข้อมูลที่ผู้ใช้กรอก — เป็น discriminated union เพื่อให้ TypeScript
 * บังคับให้จัดการครบทุกประเภทเวลา switch (คู่กับ noFallthroughCasesInSwitch)
 */
export type QrData =
  | { type: "url"; url: string }
  | { type: "text"; text: string }
  | {
      type: "wifi";
      ssid: string;
      password: string;
      encryption: WifiEncryption;
      hidden: boolean;
    }
  | {
      type: "vcard";
      firstName: string;
      lastName: string;
      organization: string;
      title: string;
      phone: string;
      email: string;
      website: string;
    }
  | { type: "tel"; phone: string }
  | { type: "sms"; phone: string; message: string }
  | { type: "email"; to: string; subject: string; body: string }
  | { type: "line"; officialAccountId: string };

export type QrDataOf<T extends QrType> = Extract<QrData, { type: T }>;

export function isQrType(value: string): value is QrType {
  return (QR_TYPES as readonly string[]).includes(value);
}

export const QR_TYPE_LABELS: Record<QrType, string> = {
  url: "ลิงก์เว็บไซต์",
  text: "ข้อความ",
  wifi: "WiFi",
  vcard: "นามบัตร",
  tel: "เบอร์โทร",
  sms: "SMS",
  email: "อีเมล",
  line: "LINE",
};

export const QR_TYPE_DESCRIPTIONS: Record<QrType, string> = {
  url: "สแกนแล้วเปิดเว็บไซต์ที่ระบุ",
  text: "สแกนแล้วแสดงข้อความ ไม่ต้องต่อเน็ต",
  wifi: "สแกนแล้วเชื่อมต่อ WiFi อัตโนมัติ ไม่ต้องพิมพ์รหัส",
  vcard: "สแกนแล้วบันทึกรายชื่อลงสมุดโทรศัพท์",
  tel: "สแกนแล้วโทรออกทันที",
  sms: "สแกนแล้วเปิดหน้าส่ง SMS พร้อมข้อความ",
  email: "สแกนแล้วเปิดหน้าเขียนอีเมลพร้อมหัวข้อ",
  line: "สแกนแล้วเปิดโปรไฟล์ LINE Official Account",
};

/** ค่าเริ่มต้นของแต่ละประเภท ใช้ตอนผู้ใช้สลับประเภท */
export function emptyQrData(type: QrType): QrData {
  switch (type) {
    case "url":
      return { type: "url", url: "" };
    case "text":
      return { type: "text", text: "" };
    case "wifi":
      return {
        type: "wifi",
        ssid: "",
        password: "",
        encryption: "WPA",
        hidden: false,
      };
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
    case "tel":
      return { type: "tel", phone: "" };
    case "sms":
      return { type: "sms", phone: "", message: "" };
    case "email":
      return { type: "email", to: "", subject: "", body: "" };
    case "line":
      return { type: "line", officialAccountId: "" };
  }
}

/** ประเภทนี้กรอกครบพอที่จะสร้าง QR ได้หรือยัง */
export function isQrDataComplete(data: QrData): boolean {
  switch (data.type) {
    case "url":
      return data.url.trim().length > 0;
    case "text":
      return data.text.trim().length > 0;
    case "wifi":
      return data.ssid.trim().length > 0;
    case "vcard":
      return (
        data.firstName.trim().length > 0 || data.lastName.trim().length > 0
      );
    case "tel":
      return data.phone.trim().length > 0;
    case "sms":
      return data.phone.trim().length > 0;
    case "email":
      return data.to.trim().length > 0;
    case "line":
      return data.officialAccountId.trim().length > 0;
  }
}
