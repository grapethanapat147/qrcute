import type { QrMatrix } from "./encode";
import { formatNumber, toPdfPathData } from "./geometry";
import { mmToPt } from "./print";
import { qrPaths } from "./render-svg";
import { parseHexColor, type QrStyle } from "./style";

/**
 * เขียนไฟล์ PDF สำหรับงานพิมพ์เอง โดยไม่พึ่งไลบรารีภายนอก
 *
 * เนื้อหาที่ต้องเขียนมีแค่เส้นทางทึบสีเดียวบนหน้ากระดาษ ซึ่งเป็น PDF ที่ง่ายมาก
 * ส่วนที่ไลบรารีทั่วไปทำได้ไม่ดีคือ CMYK ซึ่งจำเป็นกับงานพิมพ์จริง
 * และขนาดไฟล์ของไลบรารี (~350KB) หนักเกินไปสำหรับหน้าที่ต้องคุม Core Web Vitals
 *
 * ใช้ operator ชุดเล็กมาก: k (สี CMYK), re (สี่เหลี่ยม), m/l/c/h (เส้นทาง),
 * f และ f* (ระบายทึบ แบบ nonzero และ even-odd), cm (แปลงพิกัด), q/Q (จำ/คืนสถานะ)
 */

/**
 * แปลง hex เป็น CMYK
 *
 * ใช้สูตรตรงไปตรงมา ทำให้สีดำสนิทออกมาเป็น K ล้วน (0 0 0 1) ซึ่งเป็นสิ่งที่
 * โรงพิมพ์ต้องการสำหรับ QR — ถ้าใช้ rich black สี่เม็ดสีจะเหลื่อมกันแล้วขอบเบลอ
 */
export function hexToCmyk(hex: string): [number, number, number, number] {
  const rgb = parseHexColor(hex);
  if (rgb === null) return [0, 0, 0, 1];

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);

  if (k === 1) return [0, 0, 0, 1];

  return [
    (1 - r - k) / (1 - k),
    (1 - g - k) / (1 - k),
    (1 - b - k) / (1 - k),
    k,
  ];
}

function cmykOperator(hex: string): string {
  return `${hexToCmyk(hex)
    .map((value) => formatNumber(value, 4))
    .join(" ")} k`;
}

export type PdfRenderOptions = {
  style: QrStyle;
  pageWidthMm: number;
  pageHeightMm: number;
  qrSizeMm: number;
};

function buildContentStream(
  matrix: QrMatrix,
  options: PdfRenderOptions,
): string {
  const { style, pageWidthMm, pageHeightMm, qrSizeMm } = options;

  const pageHeightPt = mmToPt(pageHeightMm);
  const qrSizePt = mmToPt(qrSizeMm);
  const offsetX = (mmToPt(pageWidthMm) - qrSizePt) / 2;
  const offsetY = (pageHeightPt - qrSizePt) / 2;
  const scale = qrSizePt / matrix.size;

  const paths = qrPaths(matrix, style);
  const n = formatNumber;

  return [
    // พื้นหลังของ QR รวม quiet zone — ระบายเฉพาะพื้นที่ QR ไม่ใช่ทั้งหน้า
    "q",
    cmykOperator(style.paper),
    `${n(offsetX)} ${n(offsetY)} ${n(qrSizePt)} ${n(qrSizePt)} re f`,
    "Q",
    "q",
    cmykOperator(style.ink),
    // พลิกแกน Y เพราะ PDF นับจากมุมล่างซ้าย ส่วนเรขาคณิตของเรานับจากมุมบนซ้าย
    `${n(scale)} 0 0 ${n(-scale)} ${n(offsetX)} ${n(offsetY + qrSizePt)} cm`,
    toPdfPathData(paths.data),
    "f",
    toPdfPathData(paths.eyeFrames),
    "f*",
    toPdfPathData(paths.eyeBalls),
    "f",
    "Q",
  ].join("\n");
}

/**
 * ประกอบไฟล์ PDF
 *
 * ทุกอย่างเป็น ASCII ล้วน ทำให้ตำแหน่งตัวอักษรเท่ากับตำแหน่ง byte
 * จึงคำนวณ xref offset จากความยาวสตริงได้ตรง ๆ
 */
export function renderPdf(matrix: QrMatrix, options: PdfRenderOptions): string {
  const content = buildContentStream(matrix, options);
  const widthPt = formatNumber(mmToPt(options.pageWidthMm));
  const heightPt = formatNumber(mmToPt(options.pageHeightMm));

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] /Contents 4 0 R /Resources << /ProcSet [/PDF] >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Producer (QR Thai) >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return pdf;
}

export function renderPdfBlob(
  matrix: QrMatrix,
  options: PdfRenderOptions,
): Blob {
  return new Blob([renderPdf(matrix, options)], { type: "application/pdf" });
}
