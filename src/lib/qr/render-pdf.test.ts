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
import { DEFAULT_QR_STYLE, type QrStyle } from "./style";

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
    // การจัดกึ่งกลางอยู่ในเมทริกซ์แปลงพิกัด: scale 0 0 -scale originX originY cm
    const cm = /([\d.]+) 0 0 (-[\d.]+) ([\d.]+) ([\d.]+) cm/.exec(pdf);
    expect(cm).not.toBeNull();

    const scale = Number(cm?.[1]);
    const originX = Number(cm?.[3]);
    expect(ptToMm(originX)).toBeCloseTo((105 - 80) / 2, 3);
    expect(ptToMm(scale * matrix.size)).toBeCloseTo(80, 3);
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

describe("โลโก้ใน PDF", () => {
  const logoRaster = { hex: "ffd8ffdb00", widthPx: 512, heightPx: 512 };
  const styleWithLogo = {
    ...DEFAULT_QR_STYLE,
    logo: { src: "data:image/png;base64,AAAA", sizeRatio: 0.25 },
  };

  function pdfWithLogo() {
    return renderPdf(matrix, {
      style: styleWithLogo,
      logo: logoRaster,
      pageWidthMm: 50,
      pageHeightMm: 50,
      qrSizeMm: 50,
    });
  }

  it("ไม่มีโลโก้ก็ไม่ประกาศ XObject ให้เปลือง", () => {
    const pdf = pdfFor();
    expect(pdf).not.toContain("/XObject");
    expect(pdf).not.toContain("/Logo Do");
  });

  it("ฝังภาพเป็น XObject และเรียกใช้ในหน้า", () => {
    const pdf = pdfWithLogo();
    expect(pdf).toContain("/XObject << /Logo 6 0 R >>");
    expect(pdf).toContain("/Logo Do");
    expect(pdf).toContain("/Subtype /Image");
  });

  it("ใช้ DCTDecode หุ้มด้วย ASCIIHexDecode เพื่อให้ไฟล์ยังเป็น ASCII ล้วน", () => {
    const pdf = pdfWithLogo();
    expect(pdf).toContain("/Filter [/ASCIIHexDecode /DCTDecode]");
    expect(new TextEncoder().encode(pdf).length).toBe(pdf.length);
  });

  it("stream ของภาพจบด้วย > ตามที่ ASCIIHexDecode ต้องการ และ /Length ตรง", () => {
    const pdf = pdfWithLogo();
    const match =
      /\/Filter \[\/ASCIIHexDecode \/DCTDecode\] \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(
        pdf,
      );
    expect(match).not.toBeNull();
    expect(match?.[2]).toBe(`${logoRaster.hex}>`);
    expect(match?.[2]?.length).toBe(Number(match?.[1]));
  });

  it("xref ครอบ object ที่เพิ่มมาด้วย", () => {
    const pdf = pdfWithLogo();
    expect(pdf).toContain("xref\n0 7");
    expect(pdf).toContain("/Size 7");

    const entries = (/xref\n0 \d+\n([\s\S]*?)trailer/.exec(pdf)?.[1] ?? "")
      .trimEnd()
      .split("\n");
    entries.slice(1).forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      expect(pdf.slice(offset, offset + 8)).toContain(`${index + 1} 0 obj`);
    });
  });

  it("ส่ง raster มาแต่ style ไม่มีโลโก้ ต้องไม่วาดอะไร", () => {
    const pdf = renderPdf(matrix, {
      style: DEFAULT_QR_STYLE,
      logo: logoRaster,
      pageWidthMm: 50,
      pageHeightMm: 50,
      qrSizeMm: 50,
    });
    expect(pdf).not.toContain("/Logo Do");
  });
});

describe("กรอบและแถบข้อความใน PDF", () => {
  const band = { hex: "ffd8ffdb01", widthPx: 1024, heightPx: 160 };
  const barStyle = {
    ...DEFAULT_QR_STYLE,
    frame: { ...DEFAULT_QR_STYLE.frame, kind: "bar" as const },
  };
  const outlineStyle = {
    ...DEFAULT_QR_STYLE,
    frame: { ...DEFAULT_QR_STYLE.frame, kind: "outline" as const },
  };

  function pdfWithFrame(style: QrStyle) {
    return renderPdf(matrix, {
      style,
      band,
      pageWidthMm: 100,
      pageHeightMm: 100,
      qrSizeMm: 80,
    });
  }

  it("ฝังแถบข้อความเป็น XObject และเรียกใช้", () => {
    const pdf = pdfWithFrame(barStyle);
    expect(pdf).toContain("/XObject << /Band 6 0 R >>");
    expect(pdf).toContain("/Band Do");
  });

  it("แบบมีกรอบรอบวาดพื้นหลังสีกรอบเพิ่มมาอีกชั้น", () => {
    const outline = pdfWithFrame(outlineStyle);
    const bar = pdfWithFrame(barStyle);
    expect(outline.length).toBeGreaterThan(bar.length);
  });

  it("ไม่ส่งภาพแถบมาก็ไม่เรียกใช้ ถึงจะเลือกกรอบไว้", () => {
    const pdf = renderPdf(matrix, {
      style: barStyle,
      pageWidthMm: 100,
      pageHeightMm: 100,
      qrSizeMm: 80,
    });
    expect(pdf).not.toContain("/Band Do");
    expect(pdf).not.toContain("/XObject");
  });

  it("มีทั้งโลโก้และแถบ ต้องได้ object แยกกันสองอันและเลขไม่ชนกัน", () => {
    const pdf = renderPdf(matrix, {
      style: {
        ...barStyle,
        logo: { src: "data:image/png;base64,AAAA", sizeRatio: 0.2 },
      },
      logo: { hex: "ffd8ff00", widthPx: 512, heightPx: 512 },
      band,
      pageWidthMm: 100,
      pageHeightMm: 100,
      qrSizeMm: 80,
    });

    expect(pdf).toContain("/Logo 6 0 R");
    expect(pdf).toContain("/Band 7 0 R");
    expect(pdf).toContain("xref\n0 8");
    expect(pdf).toContain("/Size 8");
  });

  it("มีกรอบแล้ว QR ต้องเล็กลงเพราะทั้งก้อนยังกว้างเท่าที่สั่งพิมพ์", () => {
    const readScale = (pdf: string) =>
      Number(/([\d.]+) 0 0 -[\d.]+ [\d.]+ [\d.]+ cm/.exec(pdf)?.[1]);
    expect(readScale(pdfWithFrame(outlineStyle))).toBeLessThan(
      readScale(pdfFor({ pageWidthMm: 100, pageHeightMm: 100, qrSizeMm: 80 })),
    );
  });
});
