import type { QrType } from "./types";

/**
 * ประเภทที่ทำเป็น dynamic QR ได้
 *
 * dynamic ทำงานโดยฝังลิงก์ /r/xxxxx แล้วให้เครื่องอ่านเปิดลิงก์นั้น
 * ที่เหลือ (พร้อมเพย์ WiFi นามบัตร) เครื่องอ่านต้องอ่าน payload ตรง ๆ จึงทำไม่ได้
 * database มี constraint บังคับซ้ำอีกชั้น — ดู docs/decisions/0004-dynamic-qr-data-model.md
 */
export const DYNAMIC_CAPABLE_TYPES: QrType[] = ["url", "line"];

export function canBeDynamic(type: QrType): boolean {
  return DYNAMIC_CAPABLE_TYPES.includes(type);
}

export const DYNAMIC_UNSUPPORTED_REASON =
  "ประเภทนี้แก้ปลายทางทีหลังไม่ได้ เพราะเครื่องอ่านต้องอ่านข้อมูลจากตัว QR โดยตรง";

/** จำนวนวันผ่อนผันหลังเก็บเงินไม่สำเร็จ — ต้องตรงกับ GRACE_DAYS ใน lib/billing */
export const DYNAMIC_GRACE_DAYS = 30;

/** วันที่ QR ที่ถูกพักจะหยุดทำงานจริง — ต้องตรงกับ interval ใน migration ของ ADR 0008 */
export const DYNAMIC_LAPSE_DAYS = 120;

/**
 * สิ่งที่ผู้ใช้ต้องรู้ "ก่อน" กดสร้าง dynamic QR
 *
 * นี่คือ business invariant ข้อ 3 ใน CLAUDE.md เขียนเป็นข้อความไม่ใช่โค้ด
 * เจตนาคือคนที่กำลังจะเอา QR ไปพิมพ์ลงป้ายไวนิลต้องรู้ตั้งแต่ตอนนี้ว่า
 * ถ้าหยุดจ่ายแล้วจะเกิดอะไรกับป้ายที่ติดอยู่หน้าร้าน ไม่ใช่มารู้ตอนจะยกเลิก
 *
 * ตัวเลขในข้อความมี test คอยจับว่าตรงกับพฤติกรรมจริงของระบบ
 * ถ้าวันหนึ่งเปลี่ยนจำนวนวันแล้วลืมแก้ข้อความ ก็เท่ากับเราโกหกลูกค้า
 */
export const DYNAMIC_LAPSE_NOTICE =
  `QR แบบแก้ปลายทางได้ต้องมีแพ็กเกจที่ใช้งานอยู่ ถ้าหยุดจ่าย เรายังให้เวลาอีก ${DYNAMIC_GRACE_DAYS} วัน ` +
  `หลังจากนั้นคนที่สแกนจะเห็นหน้าคั่นก่อนไปปลายทาง และหลัง ${DYNAMIC_LAPSE_DAYS} วันจะหยุดทำงาน ` +
  "— ข้อมูลและปลายทางของคุณไม่ถูกลบ กลับมาจ่ายเมื่อไรก็ใช้ต่อได้ทันที";
