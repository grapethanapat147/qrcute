import { describe, expect, it } from "vitest";
import {
  generateShortcode,
  isValidShortcode,
  SHORTCODE_ALPHABET,
  SHORTCODE_KEYSPACE,
  SHORTCODE_LENGTH,
  shortcodeUrl,
} from "./shortcode";

describe("ชุดอักขระ", () => {
  it("ไม่มีอักขระที่พิมพ์ตามจากป้ายแล้วสับสน", () => {
    for (const confusing of ["0", "o", "1", "l", "i"]) {
      expect(
        SHORTCODE_ALPHABET.includes(confusing),
        `ชุดอักขระไม่ควรมี "${confusing}"`,
      ).toBe(false);
    }
  });

  it("ไม่มีตัวพิมพ์ใหญ่ ไม่มีอักขระซ้ำ", () => {
    expect(SHORTCODE_ALPHABET).toBe(SHORTCODE_ALPHABET.toLowerCase());
    expect(new Set(SHORTCODE_ALPHABET).size).toBe(SHORTCODE_ALPHABET.length);
  });

  it("พื้นที่การเดาใหญ่พอที่จะเดาสุ่มไม่เจอ", () => {
    // 31^7 ≈ 27,500 ล้าน — ดู ADR 0005
    expect(SHORTCODE_KEYSPACE).toBe(31 ** 7);
    expect(SHORTCODE_KEYSPACE).toBeGreaterThan(20_000_000_000);
  });
});

describe("generateShortcode", () => {
  it("ได้ความยาวตามที่กำหนดและใช้เฉพาะอักขระในชุด", () => {
    for (let index = 0; index < 200; index += 1) {
      const code = generateShortcode();
      expect(code).toHaveLength(SHORTCODE_LENGTH);
      expect(isValidShortcode(code)).toBe(true);
    }
  });

  it("ไม่ซ้ำกันในการสุ่มจำนวนมาก", () => {
    const codes = new Set(
      Array.from({ length: 3000 }, () => generateShortcode()),
    );
    expect(codes.size).toBe(3000);
  });

  it("ทิ้งค่าที่ทำให้การกระจายเอนเอียง แทนที่จะใช้ mod ตรง ๆ", () => {
    // byte 248-255 ต้องถูกทิ้ง เพราะ 256 หารด้วย 31 ไม่ลงตัว
    // ถ้าโค้ดใช้ % 31 ตรง ๆ จะได้อักขระตัวแรก ๆ ของชุดจากค่าพวกนี้
    const biasedBytes = [248, 249, 250, 251, 252, 253, 254, 255];
    let call = 0;
    const random = (length: number) => {
      call += 1;
      // รอบแรกส่งแต่ค่าที่ต้องถูกทิ้งทั้งหมด รอบต่อไปส่งศูนย์
      return new Uint8Array(length).map((_, index) =>
        call === 1 ? (biasedBytes[index % biasedBytes.length] ?? 255) : 0,
      );
    };

    const code = generateShortcode(random);
    // ถ้าทิ้งถูกต้อง ต้องได้อักขระตัวแรกของชุดทั้งหมดจากรอบที่สอง (byte 0)
    expect(code).toBe(SHORTCODE_ALPHABET[0]?.repeat(SHORTCODE_LENGTH));
    expect(call).toBeGreaterThan(1);
  });

  it("ใช้อักขระได้ครบทุกตัวในชุดเมื่อสุ่มมากพอ", () => {
    const seen = new Set<string>();
    for (let index = 0; index < 5000; index += 1) {
      for (const char of generateShortcode()) seen.add(char);
    }
    expect(seen.size).toBe(SHORTCODE_ALPHABET.length);
  });
});

describe("isValidShortcode", () => {
  it("ปฏิเสธความยาวที่ไม่ตรง", () => {
    expect(isValidShortcode("abc")).toBe(false);
    expect(isValidShortcode("abcdefgh")).toBe(false);
    expect(isValidShortcode("")).toBe(false);
  });

  it("ปฏิเสธอักขระนอกชุด รวมถึงตัวพิมพ์ใหญ่และอักขระที่ตัดออก", () => {
    expect(isValidShortcode("ABCDEFG")).toBe(false);
    expect(isValidShortcode("abcde0f")).toBe(false);
    expect(isValidShortcode("abcde-f")).toBe(false);
    expect(isValidShortcode("สแกนได้ดี")).toBe(false);
  });

  it("รับ shortcode ที่ระบบสร้างเองเสมอ", () => {
    expect(isValidShortcode(generateShortcode())).toBe(true);
  });
});

describe("shortcodeUrl", () => {
  it("ประกอบ URL ตามรูปแบบที่ตกลงไว้", () => {
    expect(shortcodeUrl("https://qrth.co", "a2c4e6g")).toBe(
      "https://qrth.co/r/a2c4e6g",
    );
  });

  it("ไม่เกิดสแลชซ้อนเมื่อ origin ลงท้ายด้วยสแลช", () => {
    expect(shortcodeUrl("https://qrth.co/", "a2c4e6g")).toBe(
      "https://qrth.co/r/a2c4e6g",
    );
  });

  it("โดเมนสั้นให้ URL สั้นกว่า ซึ่งแปลว่า QR จุดห่างกว่า", () => {
    const short = shortcodeUrl("https://qrth.co", "a2c4e6g");
    const long = shortcodeUrl("https://www.qrcode-thailand.com", "a2c4e6g");
    expect(short.length).toBeLessThan(long.length);
    expect(short.length).toBeLessThanOrEqual(25);
  });
});
