/**
 * กรอบและข้อความชวนสแกน (CTA)
 *
 * ⚠️ ข้อความไทยถูกวาดด้วย canvas ของเบราว์เซอร์แล้วฝังเป็นภาพ ไม่ได้แปลงเป็นเส้นเวกเตอร์
 *
 * เหตุผล: ไลบรารีอ่านฟอนต์ในจาวาสคริปต์ทำ complex script shaping ของไทยไม่ได้
 * (การวางวรรณยุกต์เหนือสระ การเลื่อนสระตามรูปพยัญชนะ) ผลลัพธ์จะได้ "สระลอย"
 * ซึ่งเป็นข้อผิดพลาดที่เราตั้งใจจะไม่ให้เกิดตั้งแต่แรก — เบราว์เซอร์มี engine จริง
 * (CoreText / HarfBuzz) อยู่แล้ว จึงให้มันจัดวางแล้วเราเก็บผลเป็นภาพ
 */

export const FRAME_KINDS = ["none", "bar", "outline"] as const;
export type FrameKind = (typeof FRAME_KINDS)[number];

export const FRAME_KIND_LABELS: Record<FrameKind, string> = {
  none: "ไม่มีกรอบ",
  bar: "แถบข้อความด้านล่าง",
  outline: "กรอบรอบพร้อมข้อความ",
};

export const FRAME_KIND_DESCRIPTIONS: Record<FrameKind, string> = {
  none: "QR เปล่า ๆ เอาไปวางในงานออกแบบอื่นต่อได้",
  bar: "เช่น ป้ายตั้งโต๊ะ สติกเกอร์ — บอกลูกค้าว่าสแกนแล้วได้อะไร",
  outline: "เช่น ป้ายหน้าร้าน — มีกรอบสีรอบ QR ทำให้เด่นขึ้นบนพื้นหลังลาย",
};

export const CTA_PRESETS = [
  "สแกนเพื่อชำระเงิน",
  "สแกนดูเมนู",
  "สแกนเพื่อเพิ่มเพื่อน",
  "สแกนเพื่อเชื่อมต่อ WiFi",
  "สแกนเพื่อบันทึกรายชื่อ",
] as const;

export const CTA_MAX_LENGTH = 40;

export type QrFrame = {
  kind: FrameKind;
  text: string;
  textColor: string;
  background: string;
};

export const DEFAULT_FRAME: QrFrame = {
  kind: "none",
  text: "สแกนเพื่อชำระเงิน",
  textColor: "#ffffff",
  background: "#123a75",
};

// ---------------------------------------------------------------------------
// เลย์เอาต์ (หน่วยเป็น module เท่ากับพิกัดของ QR)
// ---------------------------------------------------------------------------

/** ความหนาของกรอบรอบนอก */
const OUTLINE_MODULES = 1.5;
/** ความสูงของแถบข้อความ เทียบกับความกว้างของ QR */
const BAND_RATIO = 0.16;
const MIN_BAND_MODULES = 5;

export type FrameLayout = {
  width: number;
  height: number;
  /** ตำแหน่งมุมบนซ้ายของ QR ในพื้นที่รวม */
  qrX: number;
  qrY: number;
  /** แถบข้อความ — ไม่มีเมื่อ kind เป็น none */
  band: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  /** ความโค้งมุมของพื้นหลังทั้งก้อน */
  radius: number;
};

/**
 * คำนวณพื้นที่รวมของ QR กับกรอบ
 *
 * แถบข้อความอยู่ถัดจากขอบล่างของ matrix ซึ่งรวม quiet zone ไว้แล้ว
 * จึงไม่ไปรบกวนพื้นที่ว่างที่เครื่องอ่านต้องใช้หาขอบ QR
 */
export function frameLayout(matrixSize: number, frame: QrFrame): FrameLayout {
  if (frame.kind === "none" || frame.text.trim() === "") {
    return {
      width: matrixSize,
      height: matrixSize,
      qrX: 0,
      qrY: 0,
      band: null,
      radius: 0,
    };
  }

  const bandHeight = Math.max(
    MIN_BAND_MODULES,
    Math.round(matrixSize * BAND_RATIO),
  );
  const border = frame.kind === "outline" ? OUTLINE_MODULES : 0;

  const width = matrixSize + border * 2;
  const height = matrixSize + border + bandHeight;

  return {
    width,
    height,
    qrX: border,
    qrY: border,
    band: {
      x: border,
      y: border + matrixSize,
      width: matrixSize,
      height: bandHeight,
    },
    radius: frame.kind === "outline" ? OUTLINE_MODULES * 1.5 : 0,
  };
}

// ---------------------------------------------------------------------------
// จัดข้อความให้พอดีกล่อง
// ---------------------------------------------------------------------------

/** วัดความกว้างข้อความที่ขนาดฟอนต์หนึ่ง ๆ — แยกออกมาเพื่อให้ทดสอบได้โดยไม่ต้องมี canvas */
export type MeasureText = (text: string, fontSizePx: number) => number;

export type FittedText = {
  lines: string[];
  fontSizePx: number;
};

const MIN_FONT_RATIO = 0.28;
const SHRINK_STEP = 0.96;

/**
 * ย่อและตัดบรรทัดข้อความให้อยู่ในกล่อง
 *
 * ตัดบรรทัดที่ช่องว่างเท่านั้น ไม่ตัดกลางคำ เพราะภาษาไทยไม่มีช่องว่างระหว่างคำ
 * การตัดเองมีโอกาสตัดผิดที่จนอ่านไม่รู้เรื่อง — ถ้าไม่มีช่องว่างให้ย่อฟอนต์แทน
 */
export function fitCtaText(
  text: string,
  boxWidth: number,
  boxHeight: number,
  measure: MeasureText,
): FittedText {
  const trimmed = text.trim();
  if (trimmed === "") return { lines: [], fontSizePx: 0 };

  const singleLineStart = boxHeight * 0.55;
  const minFontSize = boxHeight * MIN_FONT_RATIO;

  let fontSize = singleLineStart;
  while (fontSize > minFontSize && measure(trimmed, fontSize) > boxWidth) {
    fontSize *= SHRINK_STEP;
  }
  if (measure(trimmed, fontSize) <= boxWidth) {
    return { lines: [trimmed], fontSizePx: fontSize };
  }

  const spaceIndex = findBalancedSpace(trimmed);
  if (spaceIndex === -1) {
    // ไม่มีช่องว่างให้ตัด — ย่อต่อจนสุดแล้วยอมรับตามนั้น ดีกว่าตัดกลางคำไทย
    return { lines: [trimmed], fontSizePx: minFontSize };
  }

  const lines = [
    trimmed.slice(0, spaceIndex).trim(),
    trimmed.slice(spaceIndex + 1).trim(),
  ];

  let twoLineSize = boxHeight * 0.38;
  const twoLineMin = boxHeight * 0.2;
  while (
    twoLineSize > twoLineMin &&
    lines.some((line) => measure(line, twoLineSize) > boxWidth)
  ) {
    twoLineSize *= SHRINK_STEP;
  }

  return { lines, fontSizePx: twoLineSize };
}

/** หาช่องว่างที่ใกล้กลางข้อความที่สุด เพื่อให้สองบรรทัดยาวใกล้เคียงกัน */
function findBalancedSpace(text: string): number {
  const middle = text.length / 2;
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== " ") continue;
    const distance = Math.abs(index - middle);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }

  return best;
}
