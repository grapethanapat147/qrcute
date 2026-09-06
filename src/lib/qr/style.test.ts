import { describe, expect, it } from "vitest";
import { dotCoverage } from "./render-svg";
import {
  CONTRAST_BLOCK_BELOW,
  contrastRatio,
  DEFAULT_QR_STYLE,
  DOT_SHAPES,
  MARGIN_OPTIONS,
  MAX_MARGIN,
  MIN_MARGIN,
  nearestMarginOption,
  parseHexColor,
  QR_STYLE_PRESETS,
  validateStyle,
} from "./style";

describe("parseHexColor", () => {
  it("รองรับทั้งแบบ 3 หลักและ 6 หลัก มีหรือไม่มี #", () => {
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHexColor("#123456")).toEqual({ r: 18, g: 52, b: 86 });
  });

  it("คืน null เมื่อรูปแบบผิด", () => {
    expect(parseHexColor("blue")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull();
    expect(parseHexColor("")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("ดำกับขาวได้ 21:1 ซึ่งเป็นค่าสูงสุด", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("สีเดียวกันได้ 1:1", () => {
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });
});

describe("validateStyle", () => {
  it("ค่าเริ่มต้นผ่านโดยไม่มี error หรือ warning", () => {
    const result = validateStyle(DEFAULT_QR_STYLE);
    expect(result.error).toBeNull();
    expect(result.warning).toBeNull();
  });

  it("บล็อกเมื่อสีตัดกันน้อยเกินไป", () => {
    const result = validateStyle({
      ...DEFAULT_QR_STYLE,
      ink: "#bbbbbb",
      paper: "#ffffff",
    });
    expect(result.error).toContain("สีตัดกันน้อยเกินไป");
    expect(result.contrast).toBeLessThan(CONTRAST_BLOCK_BELOW);
  });

  it("บล็อก QR แบบสีกลับด้าน (จุดอ่อนกว่าพื้น)", () => {
    const result = validateStyle({
      ...DEFAULT_QR_STYLE,
      ink: "#ffffff",
      paper: "#000000",
    });
    expect(result.error).toContain("เข้มกว่าสีพื้นหลัง");
  });

  it("เตือนเมื่อสีตัดกันพอสแกนบนจอแต่เสี่ยงตอนพิมพ์", () => {
    const result = validateStyle({
      ...DEFAULT_QR_STYLE,
      ink: "#8c8c8c",
      paper: "#ffffff",
    });
    expect(result.error).toBeNull();
    expect(result.warning).toContain("เสี่ยงเมื่อพิมพ์");
  });

  it("คิด contrast จากสีที่อ่อนที่สุดเมื่อเปิด gradient", () => {
    const result = validateStyle({
      ...DEFAULT_QR_STYLE,
      ink: "#000000",
      inkSecondary: "#cccccc",
      gradientDirection: "diagonal",
    });
    // สีปลายทางอ่อนเกินไป ต้องถูกจับได้แม้สีต้นทางจะดำสนิท
    expect(result.error).not.toBeNull();
  });

  it("ปฏิเสธสีที่รูปแบบไม่ถูกต้อง", () => {
    expect(validateStyle({ ...DEFAULT_QR_STYLE, ink: "red" }).error).toBe(
      "รูปแบบสีไม่ถูกต้อง",
    );
  });
});

describe("preset", () => {
  it("ทุก preset ต้องผ่าน validateStyle โดยไม่มี error", () => {
    for (const preset of QR_STYLE_PRESETS) {
      const result = validateStyle(preset.style);
      expect(
        result.error,
        `preset "${preset.label}" มี error: ${result.error}`,
      ).toBeNull();
    }
  });

  it("ทุก preset ต้องไม่มีแม้แต่ warning เพราะเป็นตัวเลือกที่เราแนะนำเอง", () => {
    for (const preset of QR_STYLE_PRESETS) {
      const result = validateStyle(preset.style);
      expect(
        result.warning,
        `preset "${preset.label}" มี warning: ${result.warning}`,
      ).toBeNull();
    }
  });

  it("id ของ preset ต้องไม่ซ้ำกัน", () => {
    const ids = QR_STYLE_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("dotCoverage", () => {
  /**
   * เกณฑ์นี้มาจากการทดสอบ decode จริงเมื่อ 6 ก.ย. 2026:
   * วงกลม (0.785) สแกนติด แต่ข้าวหลามตัดขนาดเท่า module พอดี (0.50) สแกนไม่ติด
   * จึงตั้งเส้นไว้ที่ 0.75 — ถ้าจะเพิ่มรูปทรงใหม่ต้องผ่านเกณฑ์นี้
   */
  const MIN_COVERAGE = 0.75;

  it("ทุกรูปทรงจุดต้องมีพื้นที่ทึบมากพอที่จะสแกนติด", () => {
    for (const shape of DOT_SHAPES) {
      expect(
        dotCoverage(shape),
        `รูปทรง "${shape}" บางเกินไป อาจสแกนไม่ติด`,
      ).toBeGreaterThanOrEqual(MIN_COVERAGE);
    }
  });

  it("สี่เหลี่ยมเต็มช่องคือ 1.0 และวงกลมคือ π/4", () => {
    expect(dotCoverage("square")).toBe(1);
    expect(dotCoverage("dot")).toBeCloseTo(Math.PI / 4, 5);
  });
});

describe("ตัวเลือกพื้นที่ว่างรอบ QR", () => {
  it("ทุกตัวเลือกอยู่ในช่วงที่สเปกยอมรับ", () => {
    for (const option of MARGIN_OPTIONS) {
      expect(option.value).toBeGreaterThanOrEqual(MIN_MARGIN);
      expect(option.value).toBeLessThanOrEqual(MAX_MARGIN);
    }
  });

  it("มีตัวเลือกที่ตรงกับค่าเริ่มต้น ไม่งั้นผู้ใช้จะเห็นตัวเลือกที่ไม่ตรงกับของจริง", () => {
    expect(
      MARGIN_OPTIONS.some((option) => option.value === DEFAULT_QR_STYLE.margin),
    ).toBe(true);
  });

  it("เรียงจากแคบไปกว้าง", () => {
    const values = MARGIN_OPTIONS.map((option) => option.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("ค่านอกรายการจากลิงก์เก่าถูกจับให้ตัวที่ใกล้ที่สุด", () => {
    expect(nearestMarginOption(4).value).toBe(4);
    expect(nearestMarginOption(6).value).toBe(7);
    expect(nearestMarginOption(9).value).toBe(10);
    expect(nearestMarginOption(100).value).toBe(10);
  });
});
