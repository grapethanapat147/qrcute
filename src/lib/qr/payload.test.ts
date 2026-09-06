import { describe, expect, it } from "vitest";
import {
  buildPayload,
  normalizeLineId,
  normalizePhone,
  normalizeUrl,
  parsePayload,
} from "./payload";
import type { QrData } from "./types";

/**
 * ค่าตัวอย่างของทุกประเภท ใช้ค่าที่ normalize แล้ว
 * เพื่อให้ build → parse ได้ค่าเดิมเป๊ะ (การ normalize ทดสอบแยกด้านล่าง)
 */
const ROUND_TRIP_CASES: QrData[] = [
  { type: "url", url: "https://example.com/path?a=1" },
  { type: "text", text: "สแกนเพื่อดูเมนูอาหาร 🍜" },
  {
    type: "wifi",
    ssid: "ร้านกาแฟ WiFi",
    password: "coffee1234",
    encryption: "WPA",
    hidden: false,
  },
  {
    type: "vcard",
    firstName: "ธนาพัฒน์",
    lastName: "บูรณรักธรรม",
    organization: "บริษัท ตัวอย่าง จำกัด",
    title: "เจ้าของร้าน",
    phone: "0812345678",
    email: "owner@example.com",
    website: "https://example.com",
  },
  { type: "tel", phone: "0812345678" },
  { type: "sms", phone: "0812345678", message: "สั่งอาหารครับ" },
  {
    type: "email",
    to: "hello@example.com",
    subject: "สอบถามเมนู",
    body: "สวัสดีครับ อยากทราบว่า...",
  },
  { type: "line", officialAccountId: "@examplecafe" },
];

describe("buildPayload / parsePayload — round trip", () => {
  for (const data of ROUND_TRIP_CASES) {
    it(`แปลงไป-กลับได้ค่าเดิมสำหรับประเภท ${data.type}`, () => {
      expect(parsePayload(buildPayload(data))).toEqual(data);
    });
  }
});

describe("WiFi", () => {
  it("escape อักขระพิเศษใน SSID และรหัสผ่าน แล้วแปลงกลับได้ถูก", () => {
    const data: QrData = {
      type: "wifi",
      ssid: 'Cafe;Bar,"Test":\\Wifi',
      password: "pa;ss,wo:rd\\1",
      encryption: "WPA",
      hidden: true,
    };

    const payload = buildPayload(data);

    // อักขระพิเศษต้องถูก escape ไม่ใช่หลุดออกมาดิบ ๆ
    expect(payload).toContain("\\;");
    expect(payload).toContain("\\,");
    expect(payload).toContain('\\"');
    expect(parsePayload(payload)).toEqual(data);
  });

  it("ไม่ใส่รหัสผ่านลง payload เมื่อเลือกเครือข่ายแบบไม่มีรหัส", () => {
    const payload = buildPayload({
      type: "wifi",
      ssid: "FreeWifi",
      password: "ไม่ควรโผล่",
      encryption: "nopass",
      hidden: false,
    });

    expect(payload).not.toContain("ไม่ควรโผล่");
    expect(payload).toBe("WIFI:T:nopass;S:FreeWifi;;");
  });

  it("ใส่ H:true เฉพาะเมื่อเป็นเครือข่ายซ่อน", () => {
    const visible = buildPayload({
      type: "wifi",
      ssid: "A",
      password: "b",
      encryption: "WPA",
      hidden: false,
    });
    expect(visible).not.toContain("H:true");
  });
});

describe("vCard", () => {
  it("escape เครื่องหมาย ; และ , ในชื่อบริษัท", () => {
    const data: QrData = {
      type: "vcard",
      firstName: "สมชาย",
      lastName: "ใจดี",
      organization: "ร้านอาหาร; สาขา 1, ทองหล่อ",
      title: "",
      phone: "",
      email: "",
      website: "",
    };

    const payload = buildPayload(data);
    expect(payload).toContain("ORG:ร้านอาหาร\\; สาขา 1\\, ทองหล่อ");
    expect(parsePayload(payload)).toEqual(data);
  });

  it("ขึ้นต้นและลงท้ายด้วย BEGIN/END VCARD และมี VERSION", () => {
    const payload = buildPayload({
      type: "vcard",
      firstName: "A",
      lastName: "B",
      organization: "",
      title: "",
      phone: "",
      email: "",
      website: "",
    });

    expect(payload.startsWith("BEGIN:VCARD")).toBe(true);
    expect(payload.endsWith("END:VCARD")).toBe(true);
    expect(payload).toContain("VERSION:3.0");
  });
});

describe("SMS", () => {
  it("ข้อความที่มีเครื่องหมาย : ไม่ทำให้แยกเบอร์ผิด", () => {
    const data: QrData = {
      type: "sms",
      phone: "0812345678",
      message: "เวลาเปิด 09:00-18:00",
    };
    expect(parsePayload(buildPayload(data))).toEqual(data);
  });
});

describe("normalize", () => {
  it("เติม https:// ให้ URL ที่ไม่มี scheme", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("")).toBe("");
  });

  it("ตัดเว้นวรรค ขีด และวงเล็บออกจากเบอร์โทร", () => {
    expect(normalizePhone("081-234-5678")).toBe("0812345678");
    expect(normalizePhone("(02) 123 4567")).toBe("021234567");
  });

  it("เติม @ ให้ LINE Official Account ID และ encode เป็น %40", () => {
    expect(normalizeLineId("examplecafe")).toBe("@examplecafe");
    expect(
      buildPayload({ type: "line", officialAccountId: "examplecafe" }),
    ).toBe("https://line.me/R/ti/p/%40examplecafe");
  });
});

describe("ข้อจำกัดที่รู้อยู่", () => {
  it("ข้อความที่หน้าตาเหมือน URL จะถูกอ่านกลับเป็นประเภท url", () => {
    // เป็นความกำกวมของตัว payload เอง ไม่ใช่บั๊ก — payload ของ url กับ text
    // หน้าตาเหมือนกันทุกประการ ตัวสแกนก็แยกไม่ออกเช่นกัน
    const payload = buildPayload({
      type: "text",
      text: "https://example.com",
    });
    expect(parsePayload(payload).type).toBe("url");
  });
});
