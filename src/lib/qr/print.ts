/**
 * ขนาดงานพิมพ์
 *
 * หน่วยภายในของ PDF คือ point (1 pt = 1/72 นิ้ว) แต่ผู้ใช้คิดเป็นมิลลิเมตร
 * ทุกการแปลงหน่วยต้องผ่านฟังก์ชันในไฟล์นี้ ห้ามคูณเลขเองที่อื่น
 */

export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * PT_PER_INCH;
}

export function ptToMm(pt: number): number {
  return (pt / PT_PER_INCH) * MM_PER_INCH;
}

export type PrintPreset = {
  id: string;
  label: string;
  description: string;
  pageWidthMm: number;
  pageHeightMm: number;
  /** ความกว้างของ QR (รวม quiet zone) บนหน้ากระดาษ */
  qrSizeMm: number;
};

export const PRINT_PRESETS: PrintPreset[] = [
  {
    id: "sticker",
    label: "สติกเกอร์ 5×5 ซม.",
    description: "QR เต็มแผ่น ติดโต๊ะหรือหน้าเคาน์เตอร์",
    pageWidthMm: 50,
    pageHeightMm: 50,
    qrSizeMm: 50,
  },
  {
    id: "tent-a6",
    label: "ป้ายตั้งโต๊ะ A6",
    description: "105×148 มม. QR อยู่กลางแผ่น เหลือที่ว่างให้เขียนข้อความเพิ่ม",
    pageWidthMm: 105,
    pageHeightMm: 148,
    qrSizeMm: 80,
  },
  {
    id: "a4",
    label: "กระดาษ A4",
    description: "210×297 มม. สำหรับพิมพ์ที่ออฟฟิศแล้วตัดเอง",
    pageWidthMm: 210,
    pageHeightMm: 297,
    qrSizeMm: 150,
  },
  {
    id: "vinyl",
    label: "ป้ายไวนิล 60×40 ซม.",
    description: "สำหรับป้ายหน้าร้าน สแกนได้จากระยะไกล",
    pageWidthMm: 600,
    pageHeightMm: 400,
    qrSizeMm: 300,
  },
];

/**
 * ระยะสแกนที่แนะนำจากขนาด QR
 *
 * ใช้อัตราส่วน 10:1 ซึ่งเป็นหลักการคร่าว ๆ ที่ใช้กันในวงการงานพิมพ์
 * ไม่ใช่มาตรฐานที่ประกาศเป็นทางการ — ต้องยืนยันด้วยการพิมพ์จริงตาม
 * docs/promptpay-scan-test.md ก่อนเชื่อตัวเลขนี้
 */
export function recommendedScanDistanceCm(qrSizeMm: number): number {
  return Math.round(qrSizeMm);
}

export function minimumQrSizeMm(scanDistanceCm: number): number {
  return Math.round(scanDistanceCm);
}

/** ขนาดของหนึ่ง module เป็นมิลลิเมตร — ตัวชี้วัดว่าพิมพ์แล้วจะสแกนติดไหม */
export function moduleSizeMm(qrSizeMm: number, matrixSize: number): number {
  return qrSizeMm / matrixSize;
}

/**
 * เกณฑ์ขนาด module ขั้นต่ำ
 *
 * ต่ำกว่านี้เครื่องพิมพ์ทั่วไปเริ่มทำให้ขอบ module เบลอจนสแกนไม่ติด
 * เป็นหลักการคร่าว ๆ เช่นกัน — ปรับได้ที่นี่ที่เดียวเมื่อมีผลทดสอบพิมพ์จริง
 */
export const MIN_MODULE_MM = 0.5;

export function printWarning(
  qrSizeMm: number,
  matrixSize: number,
): string | null {
  const module = moduleSizeMm(qrSizeMm, matrixSize);
  if (module >= MIN_MODULE_MM) return null;

  const suggested = Math.ceil(MIN_MODULE_MM * matrixSize);
  return `แต่ละจุดจะเล็กเพียง ${module.toFixed(2)} มม. ซึ่งเสี่ยงว่าพิมพ์แล้วเบลอจนสแกนไม่ติด — ควรใช้ขนาดอย่างน้อย ${suggested} มม. หรือลดข้อมูลใน QR ลง`;
}
