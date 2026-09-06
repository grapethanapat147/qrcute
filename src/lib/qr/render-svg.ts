import type { QrMatrix } from "./encode";
import {
  DEFAULT_QR_STYLE,
  type DotShape,
  type EyeShape,
  type QrStyle,
} from "./style";

/** ขนาดของ finder pattern ตามสเปก QR — 7×7 module ที่มุมสามมุม */
const FINDER_SIZE = 7;

type Corner = { x: number; y: number };

/**
 * ตำแหน่งของ finder pattern ทั้งสามมุม
 *
 * คำนวณจาก margin ได้ตรง ๆ เพราะเรากำหนด quiet zone เอง
 * ไม่ต้องพึ่งการเดาจากข้อมูลใน matrix
 */
function finderCorners(size: number, margin: number): Corner[] {
  const last = size - margin - FINDER_SIZE;
  return [
    { x: margin, y: margin },
    { x: last, y: margin },
    { x: margin, y: last },
  ];
}

function isInsideFinder(x: number, y: number, corners: Corner[]): boolean {
  return corners.some(
    (corner) =>
      x >= corner.x &&
      x < corner.x + FINDER_SIZE &&
      y >= corner.y &&
      y < corner.y + FINDER_SIZE,
  );
}

// ---------------------------------------------------------------------------
// path helpers
// ---------------------------------------------------------------------------

type Radii = [number, number, number, number];

/** สี่เหลี่ยมที่กำหนดรัศมีมุมได้ทีละมุม (บนซ้าย, บนขวา, ล่างขวา, ล่างซ้าย) */
function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: Radii,
): string {
  const limit = Math.min(width, height) / 2;
  const [tl, tr, br, bl] = radii.map((radius) =>
    Math.max(0, Math.min(radius, limit)),
  ) as Radii;

  return [
    `M${x + tl} ${y}`,
    `H${x + width - tr}`,
    tr > 0 ? `A${tr} ${tr} 0 0 1 ${x + width} ${y + tr}` : "",
    `V${y + height - br}`,
    br > 0 ? `A${br} ${br} 0 0 1 ${x + width - br} ${y + height}` : "",
    `H${x + bl}`,
    bl > 0 ? `A${bl} ${bl} 0 0 1 ${x} ${y + height - bl}` : "",
    `V${y + tl}`,
    tl > 0 ? `A${tl} ${tl} 0 0 1 ${x + tl} ${y}` : "",
    "Z",
  ].join("");
}

/**
 * สัดส่วนพื้นที่ทึบของรูปทรงจุด เทียบกับ module สี่เหลี่ยมเต็ม
 *
 * ใช้เป็นเกณฑ์กันไม่ให้เพิ่มรูปทรงที่บางเกินจนสแกนไม่ติด
 * ค่าต่ำสุดที่ยืนยันแล้วว่าใช้ได้คือวงกลม (π/4 ≈ 0.785)
 */
export function dotCoverage(shape: DotShape): number {
  switch (shape) {
    case "square":
      return 1;
    case "rounded":
      // สี่เหลี่ยมมุมมน: หายไปเท่ากับส่วนต่างของสี่เหลี่ยมกับวงกลมที่มุมทั้งสี่
      return 1 - (4 - Math.PI) * 0.3 ** 2;
    case "dot":
      return Math.PI / 4;
  }
}

function circlePath(x: number, y: number, size: number): string {
  const radius = size / 2;
  const centerX = x + radius;
  const centerY = y + radius;
  return [
    `M${centerX - radius} ${centerY}`,
    `a${radius} ${radius} 0 1 0 ${radius * 2} 0`,
    `a${radius} ${radius} 0 1 0 ${-radius * 2} 0`,
    "Z",
  ].join("");
}

/** รัศมีมุมของรูปทรงตามุม เทียบกับด้านยาวของกรอบ */
function eyeRadii(shape: EyeShape, side: number): Radii {
  switch (shape) {
    case "square":
      return [0, 0, 0, 0];
    case "rounded":
      return [side * 0.25, side * 0.25, side * 0.25, side * 0.25];
    case "circle":
      return [side / 2, side / 2, side / 2, side / 2];
    case "leaf":
      return [side / 2, 0, side / 2, 0];
  }
}

// ---------------------------------------------------------------------------
// สร้าง path ของแต่ละส่วน
// ---------------------------------------------------------------------------

/** path ของจุดข้อมูลทั้งหมด (ไม่รวมตามุม) */
export function dataModulesPath(
  matrix: QrMatrix,
  shape: DotShape,
  corners: Corner[],
): string {
  const segments: string[] = [];

  for (let y = 0; y < matrix.size; y += 1) {
    const row = matrix.data[y];
    if (row === undefined) continue;

    if (shape === "square") {
      // รวม module ที่ติดกันในแนวนอนเป็นสี่เหลี่ยมเดียว ทำให้ไฟล์เล็กลงมาก
      let runStart = -1;
      for (let x = 0; x <= matrix.size; x += 1) {
        const filled =
          x < matrix.size && row[x] === true && !isInsideFinder(x, y, corners);
        if (filled && runStart === -1) {
          runStart = x;
        } else if (!filled && runStart !== -1) {
          const length = x - runStart;
          segments.push(`M${runStart} ${y}h${length}v1h-${length}z`);
          runStart = -1;
        }
      }
      continue;
    }

    for (let x = 0; x < matrix.size; x += 1) {
      if (row[x] !== true || isInsideFinder(x, y, corners)) continue;

      switch (shape) {
        case "rounded":
          segments.push(roundedRectPath(x, y, 1, 1, [0.3, 0.3, 0.3, 0.3]));
          break;
        case "dot":
          segments.push(circlePath(x, y, 1));
          break;
      }
    }
  }

  return segments.join("");
}

/** path ของกรอบตามุมทั้งสาม (วงแหวนหนา 1 module) */
export function eyeFramesPath(corners: Corner[], shape: EyeShape): string {
  const outerRadii = eyeRadii(shape, FINDER_SIZE);
  const innerRadii = outerRadii.map((radius) =>
    Math.max(0, radius - 1),
  ) as Radii;

  return corners
    .map(
      (corner) =>
        roundedRectPath(
          corner.x,
          corner.y,
          FINDER_SIZE,
          FINDER_SIZE,
          outerRadii,
        ) + roundedRectPath(corner.x + 1, corner.y + 1, 5, 5, innerRadii),
    )
    .join("");
}

/** path ของจุดกลางตามุมทั้งสาม (3×3 module) */
export function eyeBallsPath(corners: Corner[], shape: EyeShape): string {
  const radii = eyeRadii(shape, 3);
  return corners
    .map((corner) => roundedRectPath(corner.x + 2, corner.y + 2, 3, 3, radii))
    .join("");
}

// ---------------------------------------------------------------------------
// gradient
// ---------------------------------------------------------------------------

function gradientDefs(style: QrStyle, id: string): string {
  if (style.gradientDirection === "none") return "";

  const stops = `<stop offset="0" stop-color="${style.ink}"/><stop offset="1" stop-color="${style.inkSecondary}"/>`;

  if (style.gradientDirection === "radial") {
    return `<defs><radialGradient id="${id}">${stops}</radialGradient></defs>`;
  }

  const coordinates =
    style.gradientDirection === "horizontal"
      ? 'x1="0" y1="0" x2="1" y2="0"'
      : style.gradientDirection === "vertical"
        ? 'x1="0" y1="0" x2="0" y2="1"'
        : 'x1="0" y1="0" x2="1" y2="1"';

  return `<defs><linearGradient id="${id}" ${coordinates}>${stops}</linearGradient></defs>`;
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

export type SvgRenderOptions = {
  /** ขนาดภาพเป็น px ถ้าไม่ระบุจะไม่ใส่ width/height ให้ยืดตาม container */
  size?: number;
  style?: QrStyle;
  /** prefix ของ id ใน SVG — เปลี่ยนเมื่อมี QR หลายอันในหน้าเดียว */
  idPrefix?: string;
};

export function renderSvg(
  matrix: QrMatrix,
  options: SvgRenderOptions = {},
): string {
  const { size, style = DEFAULT_QR_STYLE, idPrefix = "qr" } = options;

  const corners = finderCorners(matrix.size, style.margin);
  const gradientId = `${idPrefix}-gradient`;
  const inkFill =
    style.gradientDirection === "none" ? style.ink : `url(#${gradientId})`;
  const eyeFill = style.eyeColor ?? inkFill;

  const dimensions =
    size === undefined ? "" : ` width="${size}" height="${size}"`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"${dimensions}`,
    ` viewBox="0 0 ${matrix.size} ${matrix.size}" shape-rendering="geometricPrecision">`,
    gradientDefs(style, gradientId),
    `<rect width="${matrix.size}" height="${matrix.size}" fill="${style.paper}"/>`,
    `<path fill="${inkFill}" d="${dataModulesPath(matrix, style.dotShape, corners)}"/>`,
    `<path fill="${eyeFill}" fill-rule="evenodd" d="${eyeFramesPath(corners, style.eyeFrameShape)}"/>`,
    `<path fill="${eyeFill}" d="${eyeBallsPath(corners, style.eyeBallShape)}"/>`,
    "</svg>",
  ].join("");
}
