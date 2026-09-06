import { describe, expect, it } from "vitest";
import { encodeQr, QrEncodeError, QUIET_ZONE_MODULES } from "./encode";
import { computePngLayout } from "./render-png";
import { renderMatrixPath, renderSvg } from "./render-svg";

describe("encodeQr", () => {
  it("คืน matrix สี่เหลี่ยมจัตุรัสที่รวม quiet zone แล้ว", () => {
    const matrix = encodeQr("https://example.com", "M");

    expect(matrix.data).toHaveLength(matrix.size);
    for (const row of matrix.data) {
      expect(row).toHaveLength(matrix.size);
    }

    // version 1 = 21 module + quiet zone สองด้าน
    expect(matrix.size).toBeGreaterThanOrEqual(21 + QUIET_ZONE_MODULES * 2);
  });

  it("มุมทั้งสี่ของ quiet zone ต้องว่างเสมอ", () => {
    const matrix = encodeQr("test", "M");
    const last = matrix.size - 1;

    expect(matrix.data[0]?.[0]).toBe(false);
    expect(matrix.data[0]?.[last]).toBe(false);
    expect(matrix.data[last]?.[0]).toBe(false);
    expect(matrix.data[last]?.[last]).toBe(false);
  });

  it("error correction สูงขึ้นทำให้ QR ใหญ่ขึ้นหรือเท่าเดิม", () => {
    const payload = "https://example.com/menu/summer-2026";
    expect(encodeQr(payload, "H").size).toBeGreaterThanOrEqual(
      encodeQr(payload, "L").size,
    );
  });

  it("รองรับข้อความภาษาไทยและ emoji", () => {
    expect(() => encodeQr("สแกนเพื่อชำระเงิน 🇹🇭", "M")).not.toThrow();
  });

  it("โยน QrEncodeError เมื่อ payload ว่าง", () => {
    expect(() => encodeQr("", "M")).toThrow(QrEncodeError);
  });

  it("โยน QrEncodeError เมื่อข้อมูลยาวเกินความจุของ QR", () => {
    expect(() => encodeQr("ก".repeat(10_000), "H")).toThrow(QrEncodeError);
  });
});

describe("renderSvg", () => {
  it("สร้าง SVG ที่มี viewBox ตรงกับขนาด matrix", () => {
    const matrix = encodeQr("https://example.com", "M");
    const svg = renderSvg(matrix, { size: 512 });

    expect(svg).toContain(`viewBox="0 0 ${matrix.size} ${matrix.size}"`);
    expect(svg).toContain('width="512" height="512"');
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("รวม module ที่ติดกันในแนวนอนเป็นสี่เหลี่ยมเดียว", () => {
    const matrix = {
      size: 4,
      version: 1,
      data: [
        [true, true, true, false],
        [false, true, false, false],
        [false, false, false, false],
        [true, false, false, true],
      ],
    };

    // แถวแรก 3 ช่องติดกัน ต้องได้ path เดียวยาว 3 ไม่ใช่ 3 path
    expect(renderMatrixPath(matrix)).toBe(
      "M0 0h3v1h-3zM1 1h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1z",
    );
  });

  it("ใช้สีดำ/ขาวล้วนเป็นค่าเริ่มต้น", () => {
    const svg = renderSvg(encodeQr("test", "M"));
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('fill="#ffffff"');
  });
});

describe("computePngLayout", () => {
  it("ปัดขนาด module ลงเป็นจำนวนเต็มเพื่อไม่ให้ขอบเบลอ", () => {
    // 29 module ใน 512px = 17.65 → ต้องได้ 17
    const layout = computePngLayout(29, 512);
    expect(layout.modulePixels).toBe(17);
    expect(Number.isInteger(layout.modulePixels)).toBe(true);
  });

  it("จัดกึ่งกลางส่วนที่เหลือจากการปัดลง", () => {
    const layout = computePngLayout(29, 512);
    // 29 × 17 = 493 เหลือ 19px แบ่งสองข้าง = 9
    expect(layout.offset).toBe(9);
    expect(layout.offset * 2 + 29 * layout.modulePixels).toBeLessThanOrEqual(
      512,
    );
  });

  it("ไม่คืนขนาด module เป็น 0 แม้ภาพเป้าหมายจะเล็กกว่า matrix", () => {
    expect(computePngLayout(100, 50).modulePixels).toBe(1);
  });
});
