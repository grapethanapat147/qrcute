import type { QrLogo } from "./logo";

/**
 * รูปแบบการแสดงผล QR
 *
 * ทุกตัวเลือกในไฟล์นี้กระทบ "สแกนติดหรือไม่" ไม่ใช่แค่ความสวย
 * จึงมี validateStyle() คอยกันค่าที่ทำให้สแกนไม่ได้ และห้ามข้ามการตรวจนี้
 */

/**
 * รูปทรงจุดที่รองรับ
 *
 * "ข้าวหลามตัด" ถูกถอดออกเมื่อ 6 ก.ย. 2026 หลังทดสอบ decode จริงแล้วพบว่า
 * decode ไม่ผ่าน 7 จาก 8 ขนาดที่ปัดให้หารจำนวน module ลงตัวแล้ว
 * (รูปทรงอื่นผ่าน 7/7 ที่เงื่อนไขเดียวกัน) แม้จะขยายให้ล้นช่อง 18% แล้วก็ตาม
 * สาเหตุ: ข้าวหลามตัดครอบคลุมพื้นที่ช่องแค่ ~50% เครื่องอ่านที่สุ่มตัวอย่าง
 * กลางช่องจึงเจอสีขาว — เป็นข้อจำกัดเชิงเรขาคณิต ไม่ใช่บั๊กที่แก้ได้
 */
export const DOT_SHAPES = ["square", "rounded", "dot"] as const;
export type DotShape = (typeof DOT_SHAPES)[number];

export const EYE_SHAPES = ["square", "rounded", "circle", "leaf"] as const;
export type EyeShape = (typeof EYE_SHAPES)[number];

export const GRADIENT_DIRECTIONS = [
  "none",
  "horizontal",
  "vertical",
  "diagonal",
  "radial",
] as const;
export type GradientDirection = (typeof GRADIENT_DIRECTIONS)[number];

/** quiet zone ขั้นต่ำตามสเปก QR — ต่ำกว่านี้เครื่องอ่านหาขอบไม่เจอ */
export const MIN_MARGIN = 4;
export const MAX_MARGIN = 10;

export type MarginOption = {
  value: number;
  label: string;
  description: string;
};

/**
 * ให้เลือกเป็นตัวเลือกที่มีชื่อ แทนที่จะเป็นแถบเลื่อนที่บอกจำนวน "ช่อง"
 * เพราะผู้ใช้ไม่รู้ว่าช่องคืออะไร และตอบไม่ได้ว่าอยากได้กี่ช่อง
 * แต่ตอบได้ว่าจะเอาไปตัดเจียนหรือวางบนพื้นลาย
 */
export const MARGIN_OPTIONS: MarginOption[] = [
  {
    value: 4,
    label: "ปกติ",
    description: "ขอบมาตรฐาน — ได้ QR ใหญ่ที่สุดเมื่อเทียบกับพื้นที่ที่มี",
  },
  {
    value: 7,
    label: "กว้าง",
    description: "เช่น สติกเกอร์หรือป้ายที่ต้องตัดเจียน — เผื่อให้ตัดพลาดได้โดยไม่กินตัว QR",
  },
  {
    value: 10,
    label: "กว้างมาก",
    description: "เช่น วางทับภาพหรือพื้นสี — กันไม่ให้ลวดลายรอบข้างรบกวนการสแกน",
  },
];

/** เผื่อกรณีลิงก์เก่าที่มีค่า margin นอกรายการ ให้เลือกตัวที่ใกล้ที่สุด */
export function nearestMarginOption(margin: number): MarginOption {
  return MARGIN_OPTIONS.reduce((closest, option) =>
    Math.abs(option.value - margin) < Math.abs(closest.value - margin)
      ? option
      : closest,
  );
}

export type QrStyle = {
  /** สีจุด (สีเข้ม) */
  ink: string;
  /** สีพื้นหลัง (สีอ่อน) */
  paper: string;
  /** สีปลายทางของ gradient — ใช้เมื่อ gradientDirection ไม่ใช่ none */
  inkSecondary: string;
  gradientDirection: GradientDirection;
  dotShape: DotShape;
  eyeFrameShape: EyeShape;
  eyeBallShape: EyeShape;
  /** สีตามุม — ว่าง = ใช้สีเดียวกับจุด */
  eyeColor: string | null;
  margin: number;
  /**
   * โลโก้ตรงกลาง — ไม่ถูกเก็บลง URL เพราะเป็น data URI ที่ยาวเกินไป
   * ผู้ใช้ที่เปิดลิงก์ที่แชร์มาจะได้ทุกอย่างยกเว้นโลโก้
   */
  logo: QrLogo | null;
};

export const DEFAULT_QR_STYLE: QrStyle = {
  ink: "#000000",
  paper: "#ffffff",
  inkSecondary: "#000000",
  gradientDirection: "none",
  dotShape: "square",
  eyeFrameShape: "square",
  eyeBallShape: "square",
  eyeColor: null,
  margin: MIN_MARGIN,
  logo: null,
};

export const DOT_SHAPE_LABELS: Record<DotShape, string> = {
  square: "สี่เหลี่ยม",
  rounded: "มุมมน",
  dot: "วงกลม",
};

export const EYE_SHAPE_LABELS: Record<EyeShape, string> = {
  square: "สี่เหลี่ยม",
  rounded: "มุมมน",
  circle: "วงกลม",
  leaf: "ใบไม้",
};

export const GRADIENT_DIRECTION_LABELS: Record<GradientDirection, string> = {
  none: "สีเดียว",
  horizontal: "ไล่ซ้าย → ขวา",
  vertical: "ไล่บน → ล่าง",
  diagonal: "ไล่ทแยงมุม",
  radial: "ไล่จากกลางออก",
};

// ---------------------------------------------------------------------------
// contrast
// ---------------------------------------------------------------------------

export function parseHexColor(
  value: string,
): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (match === null) return null;

  let hex = match[1] ?? "";
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function channelLuminance(value: number): number {
  const channel = value / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/** relative luminance ตามสูตร WCAG */
export function relativeLuminance(color: string): number | null {
  const rgb = parseHexColor(color);
  if (rgb === null) return null;
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** อัตราส่วน contrast ระหว่างสองสี (1 = เหมือนกัน, 21 = ดำกับขาว) */
export function contrastRatio(a: string, b: string): number | null {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  if (luminanceA === null || luminanceB === null) return null;

  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * เกณฑ์ contrast
 *
 * ต่ำกว่า 3:1 เครื่องอ่านส่วนใหญ่แยกจุดกับพื้นไม่ออก โดยเฉพาะเมื่อพิมพ์ลงกระดาษ
 * ที่หมึกซึมและกล้องมือถือรุ่นเก่า — บล็อกไปเลย
 * ช่วง 3:1 ถึง 4.5:1 พอสแกนได้บนจอ แต่เสี่ยงเมื่อพิมพ์ — เตือน
 *
 * ตัวเลขสองค่านี้เป็นการตัดสินใจของเรา ไม่ใช่สเปกภายนอก
 * ถ้าผลทดสอบพิมพ์จริงบอกว่าควรเข้มกว่านี้ ให้ปรับที่นี่ที่เดียว
 */
export const CONTRAST_BLOCK_BELOW = 3;
export const CONTRAST_WARN_BELOW = 4.5;

export type StyleValidation = {
  error: string | null;
  warning: string | null;
  contrast: number | null;
};

export function validateStyle(style: QrStyle): StyleValidation {
  const inkLuminance = relativeLuminance(style.ink);
  const paperLuminance = relativeLuminance(style.paper);

  if (inkLuminance === null || paperLuminance === null) {
    return { error: "รูปแบบสีไม่ถูกต้อง", warning: null, contrast: null };
  }

  // ถ้าเปิด gradient ต้องคิดจากสีที่อ่อนที่สุดของจุด เพราะจุดนั้นคือจุดที่เสี่ยงสุด
  const inkColors =
    style.gradientDirection === "none"
      ? [style.ink]
      : [style.ink, style.inkSecondary];
  if (style.eyeColor !== null) inkColors.push(style.eyeColor);

  let worst = Number.POSITIVE_INFINITY;
  for (const color of inkColors) {
    const ratio = contrastRatio(color, style.paper);
    if (ratio === null) {
      return { error: "รูปแบบสีไม่ถูกต้อง", warning: null, contrast: null };
    }
    worst = Math.min(worst, ratio);

    const luminance = relativeLuminance(color);
    if (luminance !== null && luminance > paperLuminance) {
      return {
        error: "สีจุดต้องเข้มกว่าสีพื้นหลัง — QR แบบสีกลับด้านสแกนไม่ติดกับเครื่องอ่านหลายรุ่น",
        warning: null,
        contrast: worst,
      };
    }
  }

  if (worst < CONTRAST_BLOCK_BELOW) {
    return {
      error: `สีตัดกันน้อยเกินไป (${worst.toFixed(1)}:1) ต้องอย่างน้อย ${CONTRAST_BLOCK_BELOW}:1 ไม่งั้นสแกนไม่ติด`,
      warning: null,
      contrast: worst,
    };
  }

  if (worst < CONTRAST_WARN_BELOW) {
    return {
      error: null,
      warning: `สีตัดกัน ${worst.toFixed(1)}:1 — สแกนบนจอได้ แต่เสี่ยงเมื่อพิมพ์ลงกระดาษ`,
      contrast: worst,
    };
  }

  return { error: null, warning: null, contrast: worst };
}

// ---------------------------------------------------------------------------
// presets
// ---------------------------------------------------------------------------

export type QrStylePreset = {
  id: string;
  label: string;
  description: string;
  style: QrStyle;
};

export const QR_STYLE_PRESETS: QrStylePreset[] = [
  {
    id: "classic",
    label: "คลาสสิก",
    description: "ดำ-ขาวมาตรฐาน สแกนติดที่สุดและพิมพ์ถูกที่สุด",
    style: DEFAULT_QR_STYLE,
  },
  {
    id: "soft",
    label: "มุมมน",
    description: "อ่อนโยนขึ้นแต่ยังปลอดภัย เหมาะกับคาเฟ่และร้านอาหาร",
    style: {
      ...DEFAULT_QR_STYLE,
      dotShape: "rounded",
      eyeFrameShape: "rounded",
      eyeBallShape: "rounded",
    },
  },
  {
    id: "banking",
    label: "น้ำเงินธนาคาร",
    description: "โทนน้ำเงินเข้ม เข้ากับป้ายรับชำระเงิน",
    style: {
      ...DEFAULT_QR_STYLE,
      ink: "#123a75",
      inkSecondary: "#123a75",
      dotShape: "rounded",
      eyeFrameShape: "rounded",
      eyeBallShape: "circle",
    },
  },
  {
    id: "sunset",
    label: "ไล่สีส้ม",
    description: "ไล่สีทแยงมุม สะดุดตาบนโซเชียล",
    style: {
      ...DEFAULT_QR_STYLE,
      ink: "#7a1f0a",
      inkSecondary: "#b3400f",
      gradientDirection: "diagonal",
      dotShape: "dot",
      eyeFrameShape: "circle",
      eyeBallShape: "circle",
    },
  },
  {
    id: "forest",
    label: "เขียวธรรมชาติ",
    description: "โทนเขียวเข้ม เหมาะกับร้านออร์แกนิกและคาเฟ่",
    style: {
      ...DEFAULT_QR_STYLE,
      ink: "#14432a",
      inkSecondary: "#1f6b3f",
      gradientDirection: "vertical",
      dotShape: "rounded",
      eyeFrameShape: "leaf",
      eyeBallShape: "circle",
    },
  },
  {
    id: "ink",
    label: "หมึกเข้ม",
    description: "จุดมุมมนบนพื้นครีม ดูเป็นงานคราฟต์",
    style: {
      ...DEFAULT_QR_STYLE,
      ink: "#1c1917",
      inkSecondary: "#1c1917",
      paper: "#faf7f0",
      dotShape: "rounded",
      eyeFrameShape: "square",
      eyeBallShape: "square",
    },
  },
];
