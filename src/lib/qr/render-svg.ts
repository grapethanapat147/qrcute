import type { QrMatrix } from "./encode";
import {
  type PathCommand,
  type Radii,
  roundedRect,
  toSvgPathData,
} from "./geometry";
import {
  DEFAULT_QR_STYLE,
  type DotShape,
  type EyeShape,
  type QrStyle,
} from "./style";

/** ขนาดของ finder pattern ตามสเปก QR — 7×7 module ที่มุมสามมุม */
const FINDER_SIZE = 7;

export type Corner = { x: number; y: number };

/**
 * ตำแหน่งของ finder pattern ทั้งสามมุม
 *
 * คำนวณจาก margin ได้ตรง ๆ เพราะเรากำหนด quiet zone เอง
 * ไม่ต้องพึ่งการเดาจากข้อมูลใน matrix
 */
export function finderCorners(size: number, margin: number): Corner[] {
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

/**
 * สัดส่วนพื้นที่ทึบของรูปทรงจุด เทียบกับ module สี่เหลี่ยมเต็ม
 *
 * ใช้เป็นเกณฑ์กันไม่ให้เพิ่มรูปทรงที่บางเกินจนสแกนไม่ติด
 * ค่าต่ำสุดที่ยืนยันด้วยการ decode จริงแล้วว่าใช้ได้คือวงกลม (π/4 ≈ 0.785)
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

function dotRadii(shape: DotShape): Radii {
  switch (shape) {
    case "square":
      return [0, 0, 0, 0];
    case "rounded":
      return [0.3, 0.3, 0.3, 0.3];
    case "dot":
      // รัศมีเท่าครึ่งด้าน = วงกลมพอดี
      return [0.5, 0.5, 0.5, 0.5];
  }
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
// สร้างเส้นทางของแต่ละส่วน
// ---------------------------------------------------------------------------

/** จุดข้อมูลทั้งหมด (ไม่รวมตามุม) */
export function dataModuleCommands(
  matrix: QrMatrix,
  shape: DotShape,
  corners: Corner[],
): PathCommand[] {
  const commands: PathCommand[] = [];
  const radii = dotRadii(shape);

  for (let y = 0; y < matrix.size; y += 1) {
    const row = matrix.data[y];
    if (row === undefined) continue;

    if (shape === "square") {
      // รวม module ที่ติดกันในแนวนอนเป็นสี่เหลี่ยมเดียว ลดจำนวนเส้นทางลงมาก
      let runStart = -1;
      for (let x = 0; x <= matrix.size; x += 1) {
        const filled =
          x < matrix.size && row[x] === true && !isInsideFinder(x, y, corners);
        if (filled && runStart === -1) {
          runStart = x;
        } else if (!filled && runStart !== -1) {
          commands.push(...roundedRect(runStart, y, x - runStart, 1, radii));
          runStart = -1;
        }
      }
      continue;
    }

    for (let x = 0; x < matrix.size; x += 1) {
      if (row[x] !== true || isInsideFinder(x, y, corners)) continue;
      commands.push(...roundedRect(x, y, 1, 1, radii));
    }
  }

  return commands;
}

/** กรอบตามุมทั้งสาม — วงแหวนหนา 1 module (ใช้กฎ even-odd เจาะรูตรงกลาง) */
export function eyeFrameCommands(
  corners: Corner[],
  shape: EyeShape,
): PathCommand[] {
  const outerRadii = eyeRadii(shape, FINDER_SIZE);
  const innerRadii = outerRadii.map((radius) =>
    Math.max(0, radius - 1),
  ) as Radii;

  return corners.flatMap((corner) => [
    ...roundedRect(corner.x, corner.y, FINDER_SIZE, FINDER_SIZE, outerRadii),
    ...roundedRect(corner.x + 1, corner.y + 1, 5, 5, innerRadii),
  ]);
}

/** จุดกลางตามุมทั้งสาม (3×3 module) */
export function eyeBallCommands(
  corners: Corner[],
  shape: EyeShape,
): PathCommand[] {
  const radii = eyeRadii(shape, 3);
  return corners.flatMap((corner) =>
    roundedRect(corner.x + 2, corner.y + 2, 3, 3, radii),
  );
}

export type QrPaths = {
  data: PathCommand[];
  eyeFrames: PathCommand[];
  eyeBalls: PathCommand[];
};

/**
 * เส้นทางทั้งสามกลุ่มของ QR — เป็นแหล่งความจริงเดียวที่ทั้ง SVG, PNG และ PDF ใช้ร่วมกัน
 */
export function qrPaths(matrix: QrMatrix, style: QrStyle): QrPaths {
  const corners = finderCorners(matrix.size, style.margin);
  return {
    data: dataModuleCommands(matrix, style.dotShape, corners),
    eyeFrames: eyeFrameCommands(corners, style.eyeFrameShape),
    eyeBalls: eyeBallCommands(corners, style.eyeBallShape),
  };
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

  const paths = qrPaths(matrix, style);
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
    `<path fill="${inkFill}" d="${toSvgPathData(paths.data)}"/>`,
    `<path fill="${eyeFill}" fill-rule="evenodd" d="${toSvgPathData(paths.eyeFrames)}"/>`,
    `<path fill="${eyeFill}" d="${toSvgPathData(paths.eyeBalls)}"/>`,
    "</svg>",
  ].join("");
}
