import { describe, expect, it } from "vitest";
import { MAX_LINKS, readShopLinks, validateShopPage } from "./page";

const base = {
  name: "ร้านลุงสมชาย",
  description: "",
  phone: "",
  hours: "",
  links: [],
};

describe("validateShopPage", () => {
  it("รับข้อมูลปกติ และเติม https:// ให้ลิงก์ที่พิมพ์แค่ชื่อเว็บ", () => {
    const result = validateShopPage({
      ...base,
      phone: "081-234-5678",
      links: [
        { label: "เมนู", url: "menu.example/a" },
        { label: "", url: "" },
      ],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        ...base,
        phone: "0812345678",
        links: [{ label: "เมนู", url: "https://menu.example/a" }],
      },
    });
  });

  it("ปฏิเสธลิงก์ที่รันโค้ดได้ — กัน XSS และ phishing บนโดเมนเรา", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,<b>x</b>"]) {
      expect(
        validateShopPage({ ...base, links: [{ label: "x", url }] }).ok,
      ).toBe(false);
    }
  });

  it("ต้องมีชื่อร้าน และชื่อปุ่มของทุกลิงก์", () => {
    expect(validateShopPage({ ...base, name: "  " }).ok).toBe(false);
    expect(
      validateShopPage({
        ...base,
        links: [{ label: "", url: "https://a.example" }],
      }).ok,
    ).toBe(false);
  });

  it("จำกัดจำนวนลิงก์", () => {
    const links = Array.from({ length: MAX_LINKS + 1 }, (_, i) => ({
      label: `L${i}`,
      url: `https://a.example/${i}`,
    }));
    expect(validateShopPage({ ...base, links }).ok).toBe(false);
  });
});

describe("readShopLinks", () => {
  it("ทิ้งลิงก์อันตรายที่หลุดอยู่ในฐานข้อมูล", () => {
    expect(
      readShopLinks([
        { label: "ok", url: "https://a.example" },
        { label: "bad", url: "javascript:alert(1)" },
        "ขยะ",
      ]),
    ).toEqual([{ label: "ok", url: "https://a.example/" }]);
  });

  it("ค่าที่ไม่ใช่ array คืนลิสต์ว่าง", () => {
    expect(readShopLinks(null)).toEqual([]);
  });
});
