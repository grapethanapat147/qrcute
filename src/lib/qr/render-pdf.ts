import type { QrMatrix } from "./encode";
import { frameLayout } from "./frame";
import { formatNumber, roundedRect, toPdfPathData } from "./geometry";
import { mmToPt } from "./print";
import { logoLayout, qrPaths } from "./render-svg";
import { parseHexColor, type QrStyle } from "./style";

/**
 * เขียนไฟล์ PDF สำหรับงานพิมพ์เอง โดยไม่พึ่งไลบรารีภายนอก
 *
 * ส่วนที่เป็นตัว QR เป็นเส้นเวกเตอร์สี CMYK ส่วนโลโก้และแถบข้อความเป็นภาพฝัง
 * เพราะทั้งสองอย่างมาจากผู้ใช้/จากการจัดวางตัวอักษรของเบราว์เซอร์
 *
 * ทั้งไฟล์เป็น ASCII ล้วน ทำให้ตำแหน่งตัวอักษรเท่ากับตำแหน่ง byte
 * จึงคำนวณ xref offset จากความยาวสตริงได้ตรง ๆ
 */

export type PdfImage = {
  /** ไบต์ JPEG ในรูปเลขฐานสิบหก */
  hex: string;
  widthPx: number;
  heightPx: number;
};

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
  /** ความกว้างของทั้งก้อน (QR รวมกรอบและแถบข้อความ ถ้ามี) */
  qrSizeMm: number;
  /** โลโก้ที่แปลงเป็น JPEG แล้ว — ต้องเตรียมจากฝั่ง browser ก่อนเรียก */
  logo?: PdfImage | null;
  /** แถบข้อความที่วาดด้วย canvas แล้วแปลงเป็น JPEG */
  band?: PdfImage | null;
};

type Placement = {
  originX: number;
  originY: number;
  blockWidthPt: number;
  blockHeightPt: number;
  scale: number;
};

function computePlacement(
  matrix: QrMatrix,
  options: PdfRenderOptions,
): Placement {
  const frame = frameLayout(matrix.size, options.style.frame);
  const blockWidthPt = mmToPt(options.qrSizeMm);
  const scale = blockWidthPt / frame.width;
  const blockHeightPt = frame.height * scale;

  return {
    originX: (mmToPt(options.pageWidthMm) - blockWidthPt) / 2,
    originY: (mmToPt(options.pageHeightMm) - blockHeightPt) / 2,
    blockWidthPt,
    blockHeightPt,
    scale,
  };
}

/** เมทริกซ์พลิกแกน Y — PDF นับจากมุมล่างซ้าย ส่วนเรขาคณิตของเรานับจากมุมบนซ้าย */
function flipTransform(place: Placement): string {
  const n = formatNumber;
  return `${n(place.scale)} 0 0 ${n(-place.scale)} ${n(place.originX)} ${n(place.originY + place.blockHeightPt)} cm`;
}

/** วางภาพในพิกัดหน้ากระดาษ (แกน Y ชี้ขึ้น) จึงต้องกลับด้าน y ของ layout เอง */
function imageOperators(
  name: string,
  place: Placement,
  box: { x: number; y: number; width: number; height: number },
): string[] {
  const n = formatNumber;
  const widthPt = box.width * place.scale;
  const heightPt = box.height * place.scale;
  const x = place.originX + box.x * place.scale;
  const y =
    place.originY + place.blockHeightPt - (box.y + box.height) * place.scale;

  return [
    "q",
    `${n(widthPt)} 0 0 ${n(heightPt)} ${n(x)} ${n(y)} cm`,
    `/${name} Do`,
    "Q",
  ];
}

function buildContentStream(
  matrix: QrMatrix,
  options: PdfRenderOptions,
  place: Placement,
): string {
  const { style } = options;
  const frame = frameLayout(matrix.size, style.frame);
  const paths = qrPaths(matrix, style);
  const n = formatNumber;

  const operators: string[] = [];

  // พื้นหลังกรอบ วาดเฉพาะแบบที่มีขอบสีล้อมรอบ
  if (style.frame.kind === "outline" && frame.band !== null) {
    operators.push(
      "q",
      cmykOperator(style.frame.background),
      flipTransform(place),
      toPdfPathData(
        roundedRect(0, 0, frame.width, frame.height, [
          frame.radius,
          frame.radius,
          frame.radius,
          frame.radius,
        ]),
      ),
      "f",
      "Q",
    );
  }

  // พื้นหลังของ QR รวม quiet zone
  operators.push(
    "q",
    cmykOperator(style.paper),
    flipTransform(place),
    `${n(frame.qrX)} ${n(frame.qrY)} ${n(matrix.size)} ${n(matrix.size)} re f`,
    "Q",
  );

  // ตัว QR
  operators.push(
    "q",
    cmykOperator(style.ink),
    flipTransform(place),
    `1 0 0 1 ${n(frame.qrX)} ${n(frame.qrY)} cm`,
    toPdfPathData(paths.data),
    "f",
    toPdfPathData(paths.eyeFrames),
    "f*",
    toPdfPathData(paths.eyeBalls),
    "f",
    "Q",
  );

  const logo = logoLayout(matrix, style);
  if (logo !== null && options.logo != null) {
    const radius = logo.backdropRadius;
    operators.push(
      "q",
      cmykOperator(style.paper),
      flipTransform(place),
      `1 0 0 1 ${n(frame.qrX)} ${n(frame.qrY)} cm`,
      toPdfPathData(
        roundedRect(
          logo.backdropX,
          logo.backdropY,
          logo.backdropSide,
          logo.backdropSide,
          [radius, radius, radius, radius],
        ),
      ),
      "f",
      "Q",
    );
    operators.push(
      ...imageOperators("Logo", place, {
        x: frame.qrX + logo.x,
        y: frame.qrY + logo.y,
        width: logo.side,
        height: logo.side,
      }),
    );
  }

  if (frame.band !== null && options.band != null) {
    operators.push(...imageOperators("Band", place, frame.band));
  }

  return operators.join("\n");
}

export function renderPdf(matrix: QrMatrix, options: PdfRenderOptions): string {
  const place = computePlacement(matrix, options);
  const content = buildContentStream(matrix, options, place);
  const widthPt = formatNumber(mmToPt(options.pageWidthMm));
  const heightPt = formatNumber(mmToPt(options.pageHeightMm));

  const frame = frameLayout(matrix.size, options.style.frame);
  const images: Array<{ name: string; image: PdfImage }> = [];
  if (options.style.logo !== null && options.logo != null) {
    images.push({ name: "Logo", image: options.logo });
  }
  if (frame.band !== null && options.band != null) {
    images.push({ name: "Band", image: options.band });
  }

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "", // แทนที่ทีหลัง เพราะต้องรู้เลข object ของภาพก่อน
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Producer (QR Thai) >>",
  ];

  const xObjectEntries = images
    .map(({ name }, index) => `/${name} ${6 + index} 0 R`)
    .join(" ");
  const resources =
    images.length === 0
      ? "<< /ProcSet [/PDF] >>"
      : `<< /ProcSet [/PDF /ImageC] /XObject << ${xObjectEntries} >> >>`;
  objects[2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] /Contents 4 0 R /Resources ${resources} >>`;

  for (const { image } of images) {
    // ฝังไบต์ JPEG ตรง ๆ ผ่าน DCTDecode และหุ้มด้วย ASCIIHexDecode อีกชั้น
    // เพื่อให้ไฟล์ยังเป็น ASCII ล้วน แลกกับขนาดที่โตขึ้นเท่าตัวเฉพาะส่วนภาพ
    const hexStream = `${image.hex}>`;
    objects.push(
      `<< /Type /XObject /Subtype /Image /Width ${image.widthPx} /Height ${image.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hexStream.length} >>\nstream\n${hexStream}\nendstream`,
    );
  }

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
