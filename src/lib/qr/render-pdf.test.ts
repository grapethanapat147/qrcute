import { describe, expect, it } from "vitest";
import { encodeQr } from "./encode";
import {
  MIN_MODULE_MM,
  mmToPt,
  moduleSizeMm,
  PRINT_PRESETS,
  printWarning,
  ptToMm,
  recommendedScanDistanceCm,
} from "./print";
import { hexToCmyk, renderPdf } from "./render-pdf";
import { DEFAULT_QR_STYLE } from "./style";

const matrix = encodeQr("https://example.com/menu", "M");

function pdfFor(overrides: Partial<Parameters<typeof renderPdf>[1]> = {}) {
  return renderPdf(matrix, {
    style: DEFAULT_QR_STYLE,
    pageWidthMm: 50,
    pageHeightMm: 50,
    qrSizeMm: 50,
    ...overrides,
  });
}

describe("หน่วยวัด", () => {
  it("แปลงมิลลิเมตรเป็น point ตามนิยาม 1 นิ้ว = 25.4 มม. = 72 pt", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 10);
    expect(mmToPt(210)).toBeCloseTo(595.2755905511812, 10);
  });

  it("แปลงกลับไปกลับมาได้ค่าเดิม", () => {
    expect(ptToMm(mmToPt(148))).toBeCloseTo(148, 10);
  });
});

describe("hexToCmyk", () => {
  it("ดำสนิทต้องเป็น K ล้วน ไม่ใช่ rich black", () => {
    // rich black ทำให้เม็ดสีสี่สีเหลื่อมกันแล้วขอบ module เบลอ
    expect(hexToCmyk("#000000")).toEqual([0, 0, 0, 1]);
  });

  it("ขาวต้องไม่มีหมึกเลย", () => {
    expect(hexToCmyk("#ffffff")).toEqual([0, 0, 0, 0]);
  });

  it("สีน้ำเงินเข้มแปลงแล้วมีองค์ประกอบครบ", () => {
    const [c, m, y, k] = hexToCmyk("#123a75");
    expect(c).toBeGreaterThan(0.5);
    expect(m).toBeGreaterThan(0.4);
    expect(y).toBe(0);
    expect(k).toBeGreaterThan(0.5);
  });

  it("สีที่รูปแบบผิดถอยไปเป็นดำ ไม่ใช่โยน error กลางการ export", () => {
    expect(hexToCmyk("ไม่ใช่สี")).toEqual([0, 0, 0, 1]);
  });
});

describe("โครงสร้างไฟล์ PDF", () => {
  it("ขึ้นต้นด้วย header และลงท้ายด้วย %%EOF", () => {
    const pdf = pdfFor();
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("เป็น ASCII ล้วน เพื่อให้ตำแหน่งตัวอักษรเท่ากับตำแหน่ง byte", () => {
    const pdf = pdfFor();
    expect(new TextEncoder().encode(pdf).length).toBe(pdf.length);
  });

  it("/Length ของ content stream ตรงกับความยาวจริง", () => {
    const pdf = pdfFor();
    const declared = Number(/\/Length (\d+)/.exec(pdf)?.[1]);
    const stream = /stream\n([\s\S]*?)\nendstream/.exec(pdf)?.[1] ?? "";
    expect(stream.length).toBe(declared);
  });

  it("xref ชี้ไปที่ตำแหน่งเริ่มต้นของแต่ละ object จริง", () => {
    const pdf = pdfFor();
    const xrefBlock = /xref\n0 (\d+)\n([\s\S]*?)trailer/.exec(pdf);
    expect(xrefBlock).not.toBeNull();

    const entries = (xrefBlock?.[2] ?? "").trimEnd().split("\n");
    // รายการแรกเป็น free entry ตามสเปก จึงเริ่มตรวจจากรายการที่สอง
    entries.slice(1).forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      expect(pdf.slice(offset, offset + 8)).toContain(`${index + 1} 0 obj`);
    });
  });

  it("startxref ชี้ไปที่คำว่า xref", () => {
    const pdf = pdfFor();
    const offset = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(offset, offset + 4)).toBe("xref");
  });
});

describe("ขนาดจริงของหน้ากระดาษ", () => {
  it.each(
    PRINT_PRESETS,
  )("preset $label ให้ MediaBox ตรงกับขนาดที่ระบุเป็นมิลลิเมตร", (preset) => {
    const pdf = renderPdf(matrix, {
      style: DEFAULT_QR_STYLE,
      pageWidthMm: preset.pageWidthMm,
      pageHeightMm: preset.pageHeightMm,
      qrSizeMm: preset.qrSizeMm,
    });

    const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf);
    expect(box).not.toBeNull();
    expect(ptToMm(Number(box?.[1]))).toBeCloseTo(preset.pageWidthMm, 3);
    expect(ptToMm(Number(box?.[2]))).toBeCloseTo(preset.pageHeightMm, 3);
  });

  it("A4 ได้ 595.2756 × 841.8898 pt ตามค่ามาตรฐาน", () => {
    const pdf = pdfFor({ pageWidthMm: 210, pageHeightMm: 297, qrSizeMm: 150 });
    const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf);
    expect(Number(box?.[1])).toBeCloseTo(595.2756, 3);
    expect(Number(box?.[2])).toBeCloseTo(841.8898, 3);
  });
});

describe("เนื้อหาในหน้า", () => {
  it("ใช้สี CMYK ไม่ใช่ RGB", () => {
    const pdf = pdfFor();
    expect(pdf).toContain("0 0 0 1 k");
    expect(pdf).not.toContain(" rg\n");
  });

  it("ใช้ even-odd fill กับกรอบตามุมเพื่อเจาะรูตรงกลาง", () => {
    expect(pdfFor()).toContain("f*");
  });

  it("ไม่มีสัญกรณ์ยกกำลังหลุดเข้าไป (PDF อ่านไม่ออก)", () => {
    const pdf = pdfFor({ pageWidthMm: 600, pageHeightMm: 400, qrSizeMm: 300 });
    expect(/\d[eE][+-]\d/.test(pdf)).toBe(false);
  });

  it("วาง QR ไว้กลางหน้าเมื่อหน้ากว้างกว่า QR", () => {
    const pdf = pdfFor({ pageWidthMm: 105, pageHeightMm: 148, qrSizeMm: 80 });
    const rect = /([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re f/.exec(pdf);
    expect(rect).not.toBeNull();

    const left = Number(rect?.[1]);
    const size = Number(rect?.[3]);
    expect(ptToMm(left)).toBeCloseTo((105 - 80) / 2, 3);
    expect(ptToMm(size)).toBeCloseTo(80, 3);
  });
});

describe("คำแนะนำขนาด", () => {
  it("ระยะสแกนที่แนะนำใช้อัตราส่วน 10:1", () => {
    expect(recommendedScanDistanceCm(50)).toBe(50);
    expect(recommendedScanDistanceCm(300)).toBe(300);
  });

  it("คำนวณขนาด module เป็นมิลลิเมตรได้", () => {
    expect(moduleSizeMm(50, 25)).toBe(2);
  });

  it("เตือนเมื่อ module เล็กกว่าเกณฑ์ และเงียบเมื่อใหญ่พอ", () => {
    const tiny = printWarning(10, 100);
    expect(tiny).toContain("เสี่ยง");
    expect(printWarning(100, 100)).toBeNull();
  });

  it("ขนาดที่แนะนำในคำเตือนต้องผ่านเกณฑ์จริง", () => {
    const warning = printWarning(10, 100);
    const suggested = Number(/อย่างน้อย (\d+) มม./.exec(warning ?? "")?.[1]);
    expect(moduleSizeMm(suggested, 100)).toBeGreaterThanOrEqual(MIN_MODULE_MM);
  });
});
