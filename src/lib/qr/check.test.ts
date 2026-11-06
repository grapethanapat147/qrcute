import { describe, expect, it } from "vitest";
import { checkQr } from "./check";
import { buildPromptPayPayload } from "./promptpay";

const OWN = "qrcute.com";

describe("checkQr", () => {
  it("พร้อมเพย์ที่ checksum ถูกต้อง = ฝังข้อมูลตรง ไม่มีวันหมดอายุ", () => {
    const payload = buildPromptPayPayload({
      targetType: "mobile",
      target: "0812345678",
      amount: "",
    });
    expect(checkQr(payload, OWN)).toEqual({
      kind: "embedded",
      label: "QR รับเงินพร้อมเพย์",
    });
  });

  it("WiFi และนามบัตรฝังข้อมูลตรง", () => {
    expect(checkQr("WIFI:T:WPA;S:shop;P:1234;;", OWN).kind).toBe("embedded");
    expect(checkQr("BEGIN:VCARD\nFN:A\nEND:VCARD", OWN).kind).toBe("embedded");
  });

  it("ลิงก์ของบริการ redirect ที่รู้จัก = อาจตายเมื่อหยุดจ่าย", () => {
    expect(checkQr("https://qrco.de/bfXyz", OWN)).toEqual({
      kind: "redirect-service",
      host: "qrco.de",
    });
    expect(checkQr("https://www.bit.ly/abc", OWN).kind).toBe(
      "redirect-service",
    );
  });

  it("โดเมนที่แค่ลงท้ายคล้ายกันต้องไม่ถูกนับเป็นบริการ redirect", () => {
    expect(checkQr("https://notbit.ly/x", OWN).kind).toBe("link");
  });

  it("ลิงก์ของเราเองแยกออกมาบอกนโยบายของเรา", () => {
    expect(checkQr("https://www.qrcute.com/r/abc2345", OWN).kind).toBe("ours");
  });

  it("ลิงก์ทั่วไปบอกโฮสต์ปลายทาง", () => {
    expect(checkQr("https://menu.example/a", OWN)).toEqual({
      kind: "link",
      host: "menu.example",
    });
  });

  it("ข้อความว่างและข้อความธรรมดา", () => {
    expect(checkQr("   ", OWN).kind).toBe("empty");
    expect(checkQr("สวัสดี", OWN).kind).toBe("embedded");
    expect(checkQr("javascript:alert(1)", OWN).kind).toBe("embedded");
  });
});
