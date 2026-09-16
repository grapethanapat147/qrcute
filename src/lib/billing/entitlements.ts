/**
 * ชั้นตรวจสิทธิ์
 *
 * ⚠️ ไฟล์นี้ต้องไม่รู้จัก payment gateway เด็ดขาด (docs/prd.md §5.1)
 * ห้าม import อะไรที่เกี่ยวกับผู้ให้บริการชำระเงิน และห้ามรับพารามิเตอร์ที่อ้างถึงเจ้าใดเจ้าหนึ่ง
 *
 * เหตุผล: เราจะเปลี่ยน gateway แน่ ๆ (ADR 0007 บอกไว้ว่าจะทบทวนเมื่อยอดโต)
 * ถ้าตรรกะสิทธิ์ผูกกับ gateway การย้ายเจ้าจะกลายเป็นการเขียนใหม่ทั้งระบบ
 */

export const PLANS = ["free", "pro", "business"] as const;
export type Plan = (typeof PLANS)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "grace",
  "canceled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const FEATURES = [
  "dynamic_qr",
  "print_pdf",
  "analytics_days",
  "bulk_csv",
  "custom_logo",
] as const;
export type Feature = (typeof FEATURES)[number];

export const UNLIMITED = Number.POSITIVE_INFINITY;

/**
 * โควตาตามแพ็กเกจ
 *
 * ตัวเลขเป็น "จำนวนที่ใช้ได้" — 0 คือใช้ไม่ได้เลย
 * ตรงกับตารางใน docs/strategy.md §4 ถ้าแก้ที่นี่ต้องแก้ที่นั่นด้วย
 */
export const PLAN_QUOTAS: Record<Plan, Record<Feature, number>> = {
  free: {
    dynamic_qr: 2,
    print_pdf: 0,
    analytics_days: 7,
    bulk_csv: 0,
    custom_logo: 0,
  },
  pro: {
    dynamic_qr: 50,
    print_pdf: UNLIMITED,
    analytics_days: 365,
    bulk_csv: 100,
    custom_logo: UNLIMITED,
  },
  business: {
    dynamic_qr: UNLIMITED,
    print_pdf: UNLIMITED,
    analytics_days: 730,
    bulk_csv: UNLIMITED,
    custom_logo: UNLIMITED,
  },
};

/** แถวจากตาราง entitlements — ใช้แจกสิทธิ์ด้วยมือสำหรับดีล B2B */
export type EntitlementRow = {
  feature: string;
  quota: number | null;
  expires_at: string | null;
};

export type SubscriptionSnapshot = {
  plan: Plan;
  status: SubscriptionStatus;
  /** หมดเวลาผ่อนผันเมื่อไร — null แปลว่าไม่เคยเข้าสู่ช่วงผ่อนผัน */
  graceUntil: string | null;
};

export type EntitlementContext = {
  subscription: SubscriptionSnapshot | null;
  entitlements: EntitlementRow[];
  now: Date;
};

/**
 * แพ็กเกจที่ใช้ได้จริง ณ เวลานี้
 *
 * ต่างจาก subscription.plan ตรงที่คิดผลของการหยุดจ่ายเข้าไปด้วย
 * ระหว่างผ่อนผันยังได้สิทธิ์เต็ม ตาม docs/decisions/0008-downgrade-behaviour.md
 */
export function effectivePlan(context: EntitlementContext): Plan {
  const subscription = context.subscription;
  if (subscription === null) return "free";

  switch (subscription.status) {
    case "active":
      return subscription.plan;

    case "past_due":
    case "grace": {
      // ยังอยู่ในช่วงผ่อนผัน = ใช้ได้เต็ม ไม่ตัดทันทีตอนตัดบัตรไม่ผ่าน
      if (subscription.graceUntil === null) return subscription.plan;
      const until = new Date(subscription.graceUntil);
      return context.now <= until ? subscription.plan : "free";
    }

    case "canceled":
      return "free";
  }
}

function isExpired(row: EntitlementRow, now: Date): boolean {
  return row.expires_at !== null && new Date(row.expires_at) < now;
}

function isFeature(value: string): value is Feature {
  return (FEATURES as readonly string[]).includes(value);
}

/**
 * โควตาที่ใช้ได้จริงของฟีเจอร์หนึ่ง
 *
 * แถวใน entitlements ชนะค่าตามแพ็กเกจเสมอ เพื่อให้แจกสิทธิ์ด้วยมือได้
 * (strategy.md บอกว่า B2B จะขายแบบ manual ไปก่อน)
 * quota เป็น null ในตาราง = ไม่จำกัด
 */
export function getQuota(
  context: EntitlementContext,
  feature: Feature,
): number {
  const granted = context.entitlements.find(
    (row) => row.feature === feature && !isExpired(row, context.now),
  );

  if (granted !== undefined) {
    return granted.quota === null ? UNLIMITED : granted.quota;
  }

  return PLAN_QUOTAS[effectivePlan(context)][feature];
}

export function hasFeature(
  context: EntitlementContext,
  feature: Feature,
): boolean {
  return getQuota(context, feature) > 0;
}

/** ใช้ตอนจะสร้างของใหม่ — บอกว่าเหลือโควตาไหม และเหลือเท่าไร */
export type QuotaCheck = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
};

export function checkQuota(
  context: EntitlementContext,
  feature: Feature,
  used: number,
): QuotaCheck {
  const limit = getQuota(context, feature);
  const remaining = limit === UNLIMITED ? UNLIMITED : Math.max(0, limit - used);

  return { allowed: used < limit, used, limit, remaining };
}

/** สิทธิ์ที่ผู้ใช้มีทั้งหมด สำหรับส่งไปแสดงผลใน UI ครั้งเดียว */
export function summarize(
  context: EntitlementContext,
): Record<Feature, number> {
  const summary = {} as Record<Feature, number>;
  for (const feature of FEATURES) {
    summary[feature] = getQuota(context, feature);
  }
  return summary;
}

/** แปลงแถวดิบจาก database ให้อยู่ในรูปที่ฟังก์ชันด้านบนใช้ได้ */
export function toContext(
  subscription: {
    plan: string;
    status: string;
    grace_until: string | null;
  } | null,
  entitlements: EntitlementRow[],
  now: Date = new Date(),
): EntitlementContext {
  const plan = PLANS.includes(subscription?.plan as Plan)
    ? (subscription?.plan as Plan)
    : "free";
  const status = SUBSCRIPTION_STATUSES.includes(
    subscription?.status as SubscriptionStatus,
  )
    ? (subscription?.status as SubscriptionStatus)
    : "active";

  return {
    subscription:
      subscription === null
        ? null
        : { plan, status, graceUntil: subscription.grace_until },
    entitlements: entitlements.filter((row) => isFeature(row.feature)),
    now,
  };
}
