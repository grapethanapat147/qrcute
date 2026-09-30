import { type Feature, PLAN_QUOTAS, type Plan } from "./entitlements";

/**
 * การกั้นฟีเจอร์ตามแพ็กเกจในหน้า generator
 *
 * ⚠️ นี่เป็นการกั้นระดับ UI เท่านั้น ไม่ใช่การบังคับใช้จริงฝั่งเซิร์ฟเวอร์
 * เพราะ CLAUDE.md กำหนดว่า "หน้า generator ต้องเป็น client-side ทั้งหมด"
 * การเรนเดอร์ PDF จึงเกิดในเบราว์เซอร์ คนที่แก้ JavaScript เองยังทำได้อยู่
 *
 * ยอมรับข้อจำกัดนี้เพราะทางเลือกคือย้ายการเรนเดอร์ไปฝั่งเซิร์ฟเวอร์
 * ซึ่งขัดสถาปัตยกรรมหลัก ทำให้ช้าลงสำหรับทุกคน และผิด business invariant ข้อ 2
 * ที่ว่าต้องสร้าง QR ได้ภายใน 5 วินาทีโดยไม่ต้องสมัคร
 * กลุ่มลูกค้าจริงคือเจ้าของร้าน ไม่ใช่คนที่เปิด devtools
 *
 * ส่วนโควตาที่มีผลต่อต้นทุนของเราจริง (dynamic_qr) ถูกบังคับฝั่งเซิร์ฟเวอร์
 * ใน src/app/actions/save-qr.ts และ RLS อยู่แล้ว
 */

/** ฟีเจอร์ที่กั้นในหน้า generator — ต้องตรงกับตารางใน docs/strategy.md §4 */
export const GENERATOR_GATED_FEATURES = [
  "print_pdf",
  "custom_logo",
] as const satisfies readonly Feature[];

export type GeneratorGatedFeature = (typeof GENERATOR_GATED_FEATURES)[number];

/** แพ็กเกจนี้ใช้ฟีเจอร์นี้ได้ไหม — 0 ในตารางโควตาแปลว่าใช้ไม่ได้เลย */
export function planAllows(plan: Plan, feature: Feature): boolean {
  return PLAN_QUOTAS[plan][feature] > 0;
}

/**
 * ข้อความชวนอัปเกรด
 *
 * บอกว่าได้อะไรเพิ่ม ไม่ใช่บอกว่าถูกห้ามอะไร คนที่เพิ่งสร้าง QR เสร็จ
 * กำลังอยู่ในจังหวะที่พอใจกับผลลัพธ์ การขึ้นข้อความตำหนิตรงนั้นทำให้เขาปิดหน้าไป
 */
export const UPGRADE_PROMPT: Record<
  GeneratorGatedFeature,
  { title: string; detail: string }
> = {
  print_pdf: {
    title: "ไฟล์สำหรับงานพิมพ์อยู่ในแพ็กเกจ Pro",
    detail:
      "SVG และ PDF ที่กำหนดขนาดเป็นมิลลิเมตรจริง ใช้สี CMYK ส่งโรงพิมพ์ได้ตรงโดยขนาดไม่เพี้ยน",
  },
  custom_logo: {
    title: "ใส่โลโก้และกรอบข้อความอยู่ในแพ็กเกจ Pro",
    detail: "วางโลโก้ร้านตรงกลาง QR และเติมกรอบพร้อมข้อความเชิญชวนภาษาไทยใต้ QR",
  },
};

export const UPGRADE_HREF = "/pricing";
