import { encode } from "uqr";

export const ERROR_CORRECTION_LEVELS = ["L", "M", "Q", "H"] as const;
export type ErrorCorrectionLevel = (typeof ERROR_CORRECTION_LEVELS)[number];

/** quiet zone ขั้นต่ำตามสเปก QR = 4 module ถ้าน้อยกว่านี้เครื่องอ่านบางรุ่นจะหาขอบไม่เจอ */
export const QUIET_ZONE_MODULES = 4;

export type QrMatrix = {
  /** true = จุดดำ · ขนาด size × size · รวม quiet zone แล้ว */
  data: boolean[][];
  size: number;
  version: number;
};

/**
 * ระดับการเผื่อข้อมูลซ้ำ (error correction)
 *
 * QR เก็บข้อมูลซ้ำไว้เผื่อบางส่วนเสียหาย ตัวเลข recovery คือสัดส่วนพื้นที่ที่
 * เสียหายได้แล้วยังอ่านออก แลกมาด้วยจำนวน module ที่มากขึ้น (จุดถี่ขึ้น)
 *
 * ⚠️ อย่าเอาค่าพวกนี้ไปโชว์ผู้ใช้ตรง ๆ — ผู้ใช้ตอบไม่ได้ว่าอยากได้กี่เปอร์เซ็นต์
 * ให้ถามจากสถานการณ์การใช้งานผ่าน QR_USE_CASES แทน แล้วแปลงเป็นระดับให้
 */
export type ErrorCorrectionInfo = {
  level: ErrorCorrectionLevel;
  /** กู้คืนข้อมูลที่เสียหายได้กี่ % */
  recovery: number;
};

export const ERROR_CORRECTION_INFO: Record<
  ErrorCorrectionLevel,
  ErrorCorrectionInfo
> = {
  L: { level: "L", recovery: 7 },
  M: { level: "M", recovery: 15 },
  Q: { level: "Q", recovery: 25 },
  H: { level: "H", recovery: 30 },
};

export const QR_USE_CASE_IDS = [
  "screen",
  "print",
  "outdoor",
  "durable",
] as const;
export type QrUseCaseId = (typeof QR_USE_CASE_IDS)[number];

export type QrUseCase = {
  id: QrUseCaseId;
  label: string;
  description: string;
  level: ErrorCorrectionLevel;
};

/**
 * คำถามที่ผู้ใช้ตอบได้จริงคือ "จะเอาไปใช้ที่ไหน" ไม่ใช่ "อยากเผื่อกี่เปอร์เซ็นต์"
 * แต่ละตัวเลือกจับคู่กับระดับ error correction แบบหนึ่งต่อหนึ่ง
 */
export const QR_USE_CASES: QrUseCase[] = [
  {
    id: "screen",
    label: "ส่งทางออนไลน์",
    description:
      "เช่น ส่งในไลน์ แปะในโพสต์ ใส่ในอีเมล — ได้ QR ที่จุดน้อยที่สุด ดูโปร่งและสแกนจากจอง่าย",
    level: "L",
  },
  {
    id: "print",
    label: "พิมพ์ใช้ในร้าน",
    description: "เช่น เมนู ใบเสร็จ นามบัตร ป้ายตั้งโต๊ะ — ทนรอยเปื้อนและรอยพับได้พอสมควร",
    level: "M",
  },
  {
    id: "outdoor",
    label: "ติดกลางแจ้ง",
    description: "เช่น ป้ายหน้าร้าน สติกเกอร์ติดกระจก ป้ายไวนิล — ทนแดด ฝุ่น และรอยขีดข่วน",
    level: "Q",
  },
  {
    id: "durable",
    label: "ต้องทนที่สุด",
    description: "เช่น ป้ายที่โดนขูดบ่อย หรือมีของมาวางบังบางส่วน — ทนสุด แลกกับจุดที่ถี่ขึ้น",
    level: "H",
  },
];

const DEFAULT_USE_CASE = QR_USE_CASES[1] as QrUseCase;

export function findUseCaseByLevel(level: ErrorCorrectionLevel): QrUseCase {
  return QR_USE_CASES.find((item) => item.level === level) ?? DEFAULT_USE_CASE;
}

export function findUseCaseById(id: string): QrUseCase {
  return QR_USE_CASES.find((item) => item.id === id) ?? DEFAULT_USE_CASE;
}

export class QrEncodeError extends Error {
  override name = "QrEncodeError";
}

/**
 * แปลง payload เป็น matrix ของ module
 *
 * คืน matrix ดิบแทนที่จะคืนรูปภาพ เพื่อให้ renderer ทุกตัว
 * (SVG / PNG / PDF ในเฟสถัดไป) วาดจากแหล่งเดียวกันและได้ผลตรงกันเป๊ะ
 */
export function encodeQr(
  payload: string,
  level: ErrorCorrectionLevel = "M",
  margin: number = QUIET_ZONE_MODULES,
): QrMatrix {
  if (payload === "") {
    throw new QrEncodeError("payload ว่าง");
  }

  try {
    const result = encode(payload, {
      ecc: level,
      border: Math.max(QUIET_ZONE_MODULES, Math.round(margin)),
    });
    return {
      data: result.data,
      size: result.size,
      version: result.version,
    };
  } catch (cause) {
    throw new QrEncodeError("สร้าง QR ไม่สำเร็จ — ข้อมูลอาจยาวเกินกว่าที่ QR รองรับ", {
      cause,
    });
  }
}
