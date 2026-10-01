import type { CheckoutIntent } from "../checkout";

/**
 * รอยต่อเดียวระหว่างระบบเรากับ API ชำระเงินของ Opn
 *
 * ทุกอย่างก่อนถึงไฟล์นี้เสร็จและทดสอบแล้ว: ตรวจราคา ตรวจสิทธิ์ กันขายเกิน
 * บันทึก checkout และแนบ metadata ที่ webhook อ่านกลับได้
 * ทุกอย่างหลังจากนี้ (webhook → เปิดสิทธิ์) ก็เสร็จและทดสอบแล้วเช่นกัน
 *
 * ⛔ ตั้งใจยังไม่เขียน implementation จริง
 *
 * CLAUDE.md: "ห้ามเดาสเปกภายนอก (payment gateway API) ถ้าไม่มั่นใจให้หยุดถาม
 * แล้วเว้น TODO ไว้ อย่าเขียนโค้ดที่เดาแล้วดูเหมือนถูก"
 *
 * โค้ดชำระเงินที่เดาแล้วดูเหมือนถูกคืออันตรายที่สุดในโปรเจกต์นี้ —
 * มันผ่าน typecheck ผ่าน test ที่ mock ไว้ แล้วไปพังตอนลูกค้าคนแรกกดจ่ายจริง
 *
 * ──────────────────────────────────────────────────────────────────────────
 * TODO ต้องยืนยันจากเอกสาร Opn และแดชบอร์ดโหมดทดสอบก่อนเขียน
 * ──────────────────────────────────────────────────────────────────────────
 *
 * บัตร (pro_monthly / pro_yearly — requiresCard = true)
 * [ ] ชื่อและเวอร์ชันของสคริปต์ Omise.js ที่ใช้ tokenize บัตรในเบราว์เซอร์
 * [ ] ⚠️ เลขบัตรต้องไม่ผ่านเซิร์ฟเวอร์เราเด็ดขาด — /terms ข้อ 7 และ /privacy ข้อ 2
 *     ประกาศไว้แล้วว่าเราไม่เห็นเลขบัตร ถ้า implementation ส่งเลขบัตรมาที่ server
 *     เอกสารกฎหมายจะกลายเป็นเท็จทันที
 * [ ] รูปแบบ request ของ POST /charges: ชื่อฟิลด์ amount / currency / card / metadata
 * [ ] รูปแบบของ return_uri และสถานะ charge ระหว่างรอ 3-D Secure
 *
 * พร้อมเพย์ (pro_lifetime — requiresCard = false)
 * [ ] วิธีสร้าง source ประเภทพร้อมเพย์ และฟิลด์ที่คืนภาพ QR กลับมา
 * [ ] อายุของ QR ที่ Opn สร้าง และเหตุการณ์ที่ส่งมาเมื่อหมดอายุ
 *
 * การต่ออายุอัตโนมัติ
 * [ ] ชื่อเหตุการณ์ตระกูล schedule.* ดู RECURRING_EVENTS_SUPPORTED ใน billing-events.ts
 *     ระหว่างที่ยังไม่ยืนยัน ขายได้เฉพาะรายการที่เก็บเงินครั้งเดียว
 *
 * ทั่วไป
 * [ ] วิธีส่ง idempotency key — ใช้ checkoutId ได้เลย เป็น UUID ที่สร้างฝั่งเราอยู่แล้ว
 * [ ] ลองยิงด้วย key โหมดทดสอบ แล้วเทียบเหตุการณ์ที่ webhook ได้รับกับ
 *     src/lib/billing/opn/event.test.ts ว่าโครงตรงกับที่เราอ่านจริง
 */

export type ChargeStart =
  | {
      /** พาผู้ใช้ไปหน้าของ Opn เช่นหน้า 3-D Secure */
      kind: "redirect";
      url: string;
      chargeId: string;
    }
  | {
      /** แสดง QR พร้อมเพย์ให้สแกน แล้วรอ webhook */
      kind: "promptpay";
      qrImageUrl: string;
      chargeId: string;
      expiresAt: Date;
    };

export class GatewayNotConfiguredError extends Error {
  override name = "GatewayNotConfiguredError";
  constructor() {
    super(
      "ยังไม่ได้เชื่อมต่อ Opn — ต้องมี OPN_SECRET_KEY และยืนยันสเปก API ตาม TODO ใน src/lib/billing/opn/charge.ts",
    );
  }
}

/** ตั้งค่า key ครบหรือยัง — ใช้ตัดสินว่าหน้า checkout จะเปิดให้กดจ่ายได้ไหม */
export function isGatewayConfigured(): boolean {
  const secret = process.env.OPN_SECRET_KEY ?? "";
  const publicKey = process.env.NEXT_PUBLIC_OPN_PUBLIC_KEY ?? "";
  return secret !== "" && publicKey !== "";
}

/**
 * เริ่มเก็บเงิน
 *
 * ⛔ ยังไม่มี implementation — ดู TODO หัวไฟล์
 * โยน error เสมอแทนที่จะคืนค่าปลอม เพื่อให้ไม่มีทางที่โค้ดนี้จะถูก deploy
 * แล้วทำเหมือนเก็บเงินสำเร็จทั้งที่ไม่ได้เก็บ
 */
export async function startCharge(
  _intent: CheckoutIntent,
): Promise<ChargeStart> {
  throw new GatewayNotConfiguredError();
}
