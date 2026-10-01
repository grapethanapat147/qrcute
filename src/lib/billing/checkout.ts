import {
  isPriceCode,
  PRICES,
  type PriceCode,
  SELLABLE_PRICE_CODES,
} from "./plans";

/**
 * การเริ่มชำระเงิน — ส่วนที่เป็นของเราทั้งหมด ไม่ผูกกับ gateway
 *
 * แยกจาก adapter ของ Opn เพราะกติกาว่า "ขายอะไรได้ ใครซื้อได้ ราคาเท่าไร"
 * เป็นความจริงของธุรกิจ ส่วน "ส่งไปที่ API ไหนด้วยรูปแบบอะไร" เป็นรายละเอียดของเจ้าที่ใช้
 * ย้าย gateway เมื่อไร ไฟล์นี้ต้องไม่ต้องแก้เลย (ADR 0007)
 */

/**
 * ⚠️ สัญญาระหว่าง checkout กับ webhook
 *
 * webhook อ่าน owner_id และ price_code จาก metadata ของ charge
 * (src/lib/billing/opn/event.ts) เพื่อรู้ว่าเงินที่เข้ามาเป็นของใครและซื้ออะไร
 * ถ้าสองฝั่งสะกดคีย์ไม่ตรงกันแม้ตัวเดียว เงินจะเข้าแต่สิทธิ์ไม่เปิด
 * และไม่มี error ให้ใครเห็นจนลูกค้าทักมาถาม — test ใน checkout.test.ts ผูกสองฝั่งไว้
 */
export const METADATA_KEYS = {
  ownerId: "owner_id",
  priceCode: "price_code",
  checkoutId: "checkout_id",
} as const;

export type CheckoutMetadata = Record<
  (typeof METADATA_KEYS)[keyof typeof METADATA_KEYS],
  string
>;

export type CheckoutIntent = {
  checkoutId: string;
  ownerId: string;
  priceCode: PriceCode;
  amountSatang: number;
  currency: "THB";
  /** พร้อมเพย์ใช้กับรายการที่ต่ออายุเองไม่ได้ (ADR 0007) */
  requiresCard: boolean;
  metadata: CheckoutMetadata;
};

/**
 * จำนวนสิทธิ์จ่ายครั้งเดียวที่เปิดขาย — docs/strategy.md §5
 *
 * หน้าราคาประกาศตัวเลขนี้ต่อสาธารณะ ถ้าขายเกินคือผิดคำที่ให้ไว้
 * ⚠️ นับจากรายการที่จ่ายสำเร็จแล้วเท่านั้น จึงมีช่องให้ขายเกินได้เล็กน้อย
 * ถ้ามีคนกดซื้อพร้อมกันตอนเหลือสิทธิ์สุดท้าย ยอมรับไว้เพราะโอกาสเกิดต่ำมาก
 * ที่ขนาดธุรกิจนี้ และขายเกินหนึ่งสองรายแก้ได้ด้วยการให้สิทธิ์ตามเดิม
 * ส่วนการล็อกแถวเพื่อกันให้ขาดจะต้องจองสิทธิ์ก่อนจ่าย ซึ่งซับซ้อนเกินคุ้มตอนนี้
 */
export const LIFETIME_SEAT_LIMIT = 100;

export type CheckoutRejection =
  | "unknown_price"
  | "not_for_sale"
  | "zero_amount"
  | "already_lifetime"
  | "sold_out";

export type StartCheckoutResult =
  | { ok: true; intent: CheckoutIntent }
  | { ok: false; reason: CheckoutRejection };

export const CHECKOUT_REJECTION_MESSAGES: Record<CheckoutRejection, string> = {
  unknown_price: "ไม่พบแพ็กเกจนี้",
  not_for_sale: "แพ็กเกจนี้ยังไม่เปิดขาย",
  zero_amount: "แพ็กเกจนี้ไม่มีค่าใช้จ่าย ไม่ต้องชำระเงิน",
  already_lifetime: "บัญชีนี้มีแพ็กเกจจ่ายครั้งเดียวอยู่แล้ว ใช้ได้ตลอดไปโดยไม่ต้องจ่ายเพิ่ม",
  sold_out: `แพ็กเกจจ่ายครั้งเดียวครบ ${LIFETIME_SEAT_LIMIT} สิทธิ์แล้ว ยังสมัคร Pro รายปีได้ตามปกติ`,
};

/**
 * ตรวจและประกอบคำขอชำระเงิน
 *
 * ทุกเงื่อนไขในนี้ต้องตรวจฝั่งเซิร์ฟเวอร์ก่อนแตะ gateway เสมอ ห้ามเชื่อค่าจากหน้าเว็บ
 * โดยเฉพาะราคา — ราคาต้องมาจาก PRICES ที่นี่เท่านั้น ไม่ใช่จากฟอร์ม
 * ไม่งั้นใครก็แก้ราคาเป็น 1 บาทจาก devtools แล้วได้ Pro ไปฟรี
 */
export function startCheckout(input: {
  checkoutId: string;
  ownerId: string;
  priceCode: string;
  /** ผู้ซื้อมีแพ็กเกจจ่ายครั้งเดียวที่ใช้งานอยู่แล้วหรือไม่ */
  hasActiveLifetime: boolean;
  /** จำนวนสิทธิ์จ่ายครั้งเดียวที่ขายสำเร็จไปแล้วทั้งระบบ */
  lifetimeSold: number;
}): StartCheckoutResult {
  if (!isPriceCode(input.priceCode))
    return { ok: false, reason: "unknown_price" };

  const code = input.priceCode;
  if (!SELLABLE_PRICE_CODES.includes(code)) {
    return { ok: false, reason: "not_for_sale" };
  }

  const price = PRICES[code];
  if (price.amountSatang <= 0) return { ok: false, reason: "zero_amount" };

  // คนที่จ่ายครั้งเดียวไปแล้วไม่ควรถูกเก็บเงินซ้ำโดยไม่ได้อะไรเพิ่ม
  // applyIntent กันการลดระดับไว้แล้ว แต่ไม่ได้กันการเก็บเงินซ้ำ — ต้องกันที่นี่
  if (input.hasActiveLifetime) return { ok: false, reason: "already_lifetime" };

  if (
    price.billingKind === "lifetime" &&
    input.lifetimeSold >= LIFETIME_SEAT_LIMIT
  ) {
    return { ok: false, reason: "sold_out" };
  }

  return {
    ok: true,
    intent: {
      checkoutId: input.checkoutId,
      ownerId: input.ownerId,
      priceCode: code,
      amountSatang: price.amountSatang,
      currency: "THB",
      requiresCard: price.requiresCard,
      metadata: {
        [METADATA_KEYS.ownerId]: input.ownerId,
        [METADATA_KEYS.priceCode]: code,
        [METADATA_KEYS.checkoutId]: input.checkoutId,
      } as CheckoutMetadata,
    },
  };
}

/**
 * slug ใน URL ของหน้า checkout → รหัสราคา
 *
 * ไม่ใช้รหัสราคาตรง ๆ ใน URL เพราะ /checkout/pro_monthly อ่านยากเวลาแชร์
 * และเปิดเผยโครงภายในโดยไม่จำเป็น
 */
export const CHECKOUT_SLUGS = {
  monthly: "pro_monthly",
  yearly: "pro_yearly",
  lifetime: "pro_lifetime",
} as const satisfies Record<string, PriceCode>;

export type CheckoutSlug = keyof typeof CHECKOUT_SLUGS;

export function priceCodeForSlug(slug: string): PriceCode | null {
  return slug in CHECKOUT_SLUGS ? CHECKOUT_SLUGS[slug as CheckoutSlug] : null;
}
