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

export type ErrorCorrectionInfo = {
  level: ErrorCorrectionLevel;
  /** กู้คืนข้อมูลที่เสียหายได้กี่ % */
  recovery: number;
  label: string;
  description: string;
};

export const ERROR_CORRECTION_INFO: Record<
  ErrorCorrectionLevel,
  ErrorCorrectionInfo
> = {
  L: {
    level: "L",
    recovery: 7,
    label: "ต่ำ (L)",
    description: "QR เล็กที่สุด เหมาะกับหน้าจอหรือที่ที่ไม่มีอะไรมาบัง",
  },
  M: {
    level: "M",
    recovery: 15,
    label: "กลาง (M)",
    description: "ค่าเริ่มต้นที่เหมาะกับงานทั่วไป สมดุลระหว่างขนาดกับความทนทาน",
  },
  Q: {
    level: "Q",
    recovery: 25,
    label: "สูง (Q)",
    description: "เหมาะกับป้ายหน้าร้านหรือสติกเกอร์ที่อาจมีรอยขีดข่วน",
  },
  H: {
    level: "H",
    recovery: 30,
    label: "สูงสุด (H)",
    description: "จำเป็นเมื่อจะใส่โลโก้ตรงกลาง หรือพิมพ์บนวัสดุที่สึกง่าย",
  },
};

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
