import type { QrMatrix } from "./encode";

export type SvgRenderOptions = {
  /** ขนาดภาพเป็น px ถ้าไม่ระบุจะไม่ใส่ width/height ให้ยืดตาม container */
  size?: number;
  ink?: string;
  paper?: string;
};

/**
 * แปลง matrix เป็น path data อันเดียว
 *
 * รวม module ที่ติดกันในแนวนอนเป็นสี่เหลี่ยมเดียว แทนที่จะสร้าง <rect> ต่อ module
 * QR version 10 มี ~3,500 module ถ้าแยกทีละอันไฟล์จะใหญ่กว่านี้หลายเท่า
 * และ PDF ในเฟสถัดไปก็ใช้ path เดียวกันนี้ได้เลย
 */
export function renderMatrixPath(matrix: QrMatrix): string {
  const segments: string[] = [];

  for (let y = 0; y < matrix.size; y += 1) {
    const row = matrix.data[y];
    if (row === undefined) continue;

    let runStart = -1;
    for (let x = 0; x <= matrix.size; x += 1) {
      const filled = x < matrix.size && row[x] === true;
      if (filled && runStart === -1) {
        runStart = x;
      } else if (!filled && runStart !== -1) {
        const length = x - runStart;
        segments.push(`M${runStart} ${y}h${length}v1h-${length}z`);
        runStart = -1;
      }
    }
  }

  return segments.join("");
}

export function renderSvg(
  matrix: QrMatrix,
  options: SvgRenderOptions = {},
): string {
  const { size, ink = "#000000", paper = "#ffffff" } = options;
  const dimensions =
    size === undefined ? "" : ` width="${size}" height="${size}"`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"${dimensions}`,
    ` viewBox="0 0 ${matrix.size} ${matrix.size}" shape-rendering="crispEdges">`,
    `<rect width="${matrix.size}" height="${matrix.size}" fill="${paper}"/>`,
    `<path fill="${ink}" d="${renderMatrixPath(matrix)}"/>`,
    "</svg>",
  ].join("");
}
