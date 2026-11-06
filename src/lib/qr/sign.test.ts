import { describe, expect, it } from "vitest";
import {
  isSignEmpty,
  signFooterLines,
  signHeaderLines,
  signLayout,
} from "./sign";

describe("ข้อความบนป้าย", () => {
  it("ใส่ชื่อร้านและชื่อบัญชีครบได้ทั้งหัวและท้าย", () => {
    const sign = { shopName: " ร้านป้าแดง ", accountName: "นางแดง ใจดี" };
    expect(isSignEmpty(sign)).toBe(false);
    expect(signHeaderLines(sign).map((line) => line.text)).toEqual([
      "ร้านป้าแดง",
    ]);
    expect(signFooterLines(sign)[0]?.text).toBe("ชื่อบัญชี นางแดง ใจดี");
  });

  it("ไม่ใส่ชื่อบัญชีก็ไม่ขึ้นคำเตือนให้ตรวจชื่อ", () => {
    const sign = { shopName: "ร้านป้าแดง", accountName: "   " };
    expect(signFooterLines(sign)).toEqual([]);
    expect(isSignEmpty({ shopName: " ", accountName: "" })).toBe(true);
  });
});

describe("signLayout", () => {
  it("A6 กับ QR 80 มม. มีที่ให้ข้อความทั้งบนและล่าง ไม่ทับ QR", () => {
    const layout = signLayout(105, 148, 80, 96);
    expect(layout.blockX).toBeCloseTo(12.5);
    const { header, footer } = layout;
    if (header === null || footer === null) throw new Error("ต้องมีที่ว่าง");
    expect(header.y + header.height).toBeLessThan(layout.blockY);
    expect(footer.y).toBeGreaterThan(layout.blockY + 96);
    expect(footer.y + footer.height).toBeLessThanOrEqual(148);
  });

  it("สติกเกอร์ที่ QR เต็มแผ่นไม่มีที่ให้ข้อความ", () => {
    const layout = signLayout(50, 50, 50, 50);
    expect(layout.header).toBeNull();
    expect(layout.footer).toBeNull();
  });
});
