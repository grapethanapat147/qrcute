import { describe, expect, it } from "vitest";
import { ERROR_CORRECTION_LEVELS } from "./encode";
import {
  clampLogoForLevel,
  clampLogoRatio,
  LOGO_MAX_BYTES,
  logoWarning,
  MAX_LOGO_RATIO,
  MEASURED_LOGO_FAILURE_RATIO,
  MIN_LOGO_RATIO,
  maxLogoRatio,
  type QrLogo,
  validateLogoFile,
} from "./logo";

const logo: QrLogo = { src: "data:image/png;base64,AAAA", sizeRatio: 0.2 };

describe("เพดานขนาดโลโก้", () => {
  it("ทุกเพดานต้องต่ำกว่าขนาดที่วัดแล้วว่าอ่านไม่ออก", () => {
    for (const level of ERROR_CORRECTION_LEVELS) {
      expect(
        MAX_LOGO_RATIO[level],
        `ระดับ ${level} ตั้งเพดานชิดขอบเกินไป`,
      ).toBeLessThan(MEASURED_LOGO_FAILURE_RATIO[level]);
    }
  });

  it("เว้นระยะจากขอบอย่างน้อย 25% ของค่าขอบ เผื่อความเสียหายตอนพิมพ์", () => {
    for (const level of ERROR_CORRECTION_LEVELS) {
      const headroom =
        1 - MAX_LOGO_RATIO[level] / MEASURED_LOGO_FAILURE_RATIO[level];
      expect(headroom, `ระดับ ${level} เหลือระยะเผื่อน้อยไป`).toBeGreaterThan(0.25);
    }
  });

  it("ระดับที่ทนกว่าต้องใส่โลโก้ได้ใหญ่กว่า", () => {
    const ratios = ERROR_CORRECTION_LEVELS.map((level) => maxLogoRatio(level));
    expect(ratios).toEqual([...ratios].sort((a, b) => a - b));
  });

  it("เพดานต้องมากกว่าขนาดต่ำสุดที่ให้เลือก ไม่งั้นแถบเลื่อนจะกลับหัว", () => {
    for (const level of ERROR_CORRECTION_LEVELS) {
      expect(maxLogoRatio(level)).toBeGreaterThan(MIN_LOGO_RATIO);
    }
  });
});

describe("clampLogoRatio", () => {
  it("บีบค่าที่เกินเพดานลงมาที่เพดาน", () => {
    expect(clampLogoRatio(0.9, "L")).toBe(MAX_LOGO_RATIO.L);
    expect(clampLogoRatio(0.9, "H")).toBe(MAX_LOGO_RATIO.H);
  });

  it("ดันค่าที่เล็กเกินขึ้นมาที่ค่าต่ำสุด", () => {
    expect(clampLogoRatio(0.001, "H")).toBe(MIN_LOGO_RATIO);
  });

  it("ค่าที่อยู่ในช่วงไม่ถูกแตะ", () => {
    expect(clampLogoRatio(0.2, "H")).toBe(0.2);
  });
});

describe("clampLogoForLevel", () => {
  it("ลดขนาดโลโก้ลงเมื่อผู้ใช้เปลี่ยนไปใช้ระดับที่ทนน้อยลง", () => {
    const style = { logo: { ...logo, sizeRatio: 0.28 } };
    expect(clampLogoForLevel(style, "L").logo?.sizeRatio).toBe(
      MAX_LOGO_RATIO.L,
    );
  });

  it("ไม่แตะ style เดิมเมื่อขนาดอยู่ในเกณฑ์อยู่แล้ว", () => {
    const style = { logo: { ...logo, sizeRatio: 0.1 } };
    expect(clampLogoForLevel(style, "H")).toBe(style);
  });

  it("ไม่มีโลโก้ก็ไม่ต้องทำอะไร", () => {
    const style = { logo: null };
    expect(clampLogoForLevel(style, "L")).toBe(style);
  });
});

describe("logoWarning", () => {
  it("เตือนเมื่อใส่โลโก้ทั้งที่เลือกระดับทนน้อย", () => {
    expect(logoWarning(logo, "L")).toContain("ต้องทนที่สุด");
    expect(logoWarning(logo, "M")).toContain("ต้องทนที่สุด");
  });

  it("เงียบเมื่อระดับทนพอแล้ว", () => {
    expect(logoWarning(logo, "Q")).toBeNull();
    expect(logoWarning(logo, "H")).toBeNull();
  });

  it("เงียบเมื่อไม่มีโลโก้", () => {
    expect(logoWarning(null, "L")).toBeNull();
  });
});

describe("validateLogoFile", () => {
  const makeFile = (type: string, size: number) =>
    ({ type, size }) as unknown as File;

  it("รับ PNG, JPEG และ WebP", () => {
    expect(validateLogoFile(makeFile("image/png", 1000))).toBeNull();
    expect(validateLogoFile(makeFile("image/jpeg", 1000))).toBeNull();
    expect(validateLogoFile(makeFile("image/webp", 1000))).toBeNull();
  });

  it("ปฏิเสธ SVG เพราะฝังสคริปต์และลิงก์ภายนอกได้", () => {
    expect(validateLogoFile(makeFile("image/svg+xml", 1000))).toBe("type");
  });

  it("ปฏิเสธไฟล์ที่ใหญ่เกินเพดาน", () => {
    expect(validateLogoFile(makeFile("image/png", LOGO_MAX_BYTES + 1))).toBe(
      "size",
    );
  });
});
