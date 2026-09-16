import type { Plan } from "./entitlements";

/**
 * รายการสินค้าและราคา
 *
 * ไม่รู้จัก payment gateway เช่นเดียวกับ entitlements — ราคาที่นี่เป็นความจริงของธุรกิจ
 * ส่วนวิธีเก็บเงินเป็นรายละเอียดของ adapter
 *
 * ราคาต้องตรงกับตารางใน docs/strategy.md §5 ถ้าแก้ที่นี่ต้องแก้ที่นั่นด้วย
 */

export const BILLING_KINDS = ["monthly", "yearly", "lifetime"] as const;
export type BillingKind = (typeof BILLING_KINDS)[number];

export type PriceCode = `${Plan}_${BillingKind}`;

export type Price = {
  code: PriceCode;
  plan: Plan;
  billingKind: BillingKind;
  /** หน่วยเป็นสตางค์ — เก็บเป็นจำนวนเต็มเสมอ ห้ามใช้ทศนิยมกับเงิน */
  amountSatang: number;
  label: string;
  /** พร้อมเพย์จ่ายซ้ำอัตโนมัติไม่ได้ (ADR 0007) — รายการที่ต่ออายุเองต้องใช้บัตร */
  requiresCard: boolean;
};

export const PRICES: Record<PriceCode, Price> = {
  free_monthly: {
    code: "free_monthly",
    plan: "free",
    billingKind: "monthly",
    amountSatang: 0,
    label: "ฟรี",
    requiresCard: false,
  },
  free_yearly: {
    code: "free_yearly",
    plan: "free",
    billingKind: "yearly",
    amountSatang: 0,
    label: "ฟรี",
    requiresCard: false,
  },
  free_lifetime: {
    code: "free_lifetime",
    plan: "free",
    billingKind: "lifetime",
    amountSatang: 0,
    label: "ฟรี",
    requiresCard: false,
  },
  pro_monthly: {
    code: "pro_monthly",
    plan: "pro",
    billingKind: "monthly",
    amountSatang: 14_900,
    label: "Pro รายเดือน",
    requiresCard: true,
  },
  pro_yearly: {
    code: "pro_yearly",
    plan: "pro",
    billingKind: "yearly",
    amountSatang: 149_000,
    label: "Pro รายปี",
    requiresCard: true,
  },
  pro_lifetime: {
    code: "pro_lifetime",
    plan: "pro",
    billingKind: "lifetime",
    amountSatang: 390_000,
    label: "Pro จ่ายครั้งเดียว",
    requiresCard: false,
  },
  business_monthly: {
    code: "business_monthly",
    plan: "business",
    billingKind: "monthly",
    amountSatang: 59_000,
    label: "Business รายเดือน",
    requiresCard: true,
  },
  business_yearly: {
    code: "business_yearly",
    plan: "business",
    billingKind: "yearly",
    amountSatang: 490_000,
    label: "Business รายปี",
    requiresCard: true,
  },
  business_lifetime: {
    code: "business_lifetime",
    plan: "business",
    billingKind: "lifetime",
    amountSatang: 0,
    label: "ไม่เปิดขาย",
    requiresCard: false,
  },
};

/** รายการที่เปิดขายจริงตอนนี้ — Business ยังขายแบบคุยกันเอง (strategy.md) */
export const SELLABLE_PRICE_CODES: PriceCode[] = [
  "pro_monthly",
  "pro_yearly",
  "pro_lifetime",
];

export function isPriceCode(value: string): value is PriceCode {
  return value in PRICES;
}

export function priceFor(code: PriceCode): Price {
  return PRICES[code];
}

const BAHT = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export function formatSatang(amountSatang: number): string {
  return BAHT.format(amountSatang / 100);
}

/** ต่ออายุถึงเมื่อไรนับจากวันที่จ่าย — lifetime ไม่มีวันหมด */
export function periodEndFrom(
  billingKind: BillingKind,
  paidAt: Date,
): Date | null {
  if (billingKind === "lifetime") return null;

  const end = new Date(paidAt);
  if (billingKind === "monthly") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);

  return end;
}
