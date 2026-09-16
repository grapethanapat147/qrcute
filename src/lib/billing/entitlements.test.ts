import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  checkQuota,
  type EntitlementContext,
  effectivePlan,
  FEATURES,
  getQuota,
  hasFeature,
  PLAN_QUOTAS,
  PLANS,
  summarize,
  toContext,
  UNLIMITED,
} from "./entitlements";

const NOW = new Date("2026-09-07T00:00:00Z");

function context(
  overrides: Partial<EntitlementContext> = {},
): EntitlementContext {
  return {
    subscription: { plan: "pro", status: "active", graceUntil: null },
    entitlements: [],
    now: NOW,
    ...overrides,
  };
}

describe("effectivePlan", () => {
  it("ไม่มี subscription ถือเป็น free", () => {
    expect(effectivePlan(context({ subscription: null }))).toBe("free");
  });

  it("จ่ายอยู่ก็ได้แพ็กเกจตามที่ซื้อ", () => {
    expect(effectivePlan(context())).toBe("pro");
  });

  it("ตัดบัตรไม่ผ่านแต่ยังอยู่ในช่วงผ่อนผัน ต้องยังได้สิทธิ์เต็ม", () => {
    // หัวใจของ ADR 0008 — ห้ามตัดสิทธิ์ทันทีที่ตัดเงินไม่ผ่าน
    const ctx = context({
      subscription: {
        plan: "pro",
        status: "past_due",
        graceUntil: "2026-10-07T00:00:00Z",
      },
    });
    expect(effectivePlan(ctx)).toBe("pro");
  });

  it("หมดเวลาผ่อนผันแล้วจึงลดเป็น free", () => {
    const ctx = context({
      subscription: {
        plan: "pro",
        status: "grace",
        graceUntil: "2026-09-06T23:59:59Z",
      },
    });
    expect(effectivePlan(ctx)).toBe("free");
  });

  it("วันสุดท้ายของการผ่อนผันยังนับว่าอยู่ในช่วง", () => {
    const ctx = context({
      subscription: {
        plan: "pro",
        status: "grace",
        graceUntil: NOW.toISOString(),
      },
    });
    expect(effectivePlan(ctx)).toBe("pro");
  });

  it("ยกเลิกแล้วเป็น free ทันที ไม่สนวันผ่อนผัน", () => {
    const ctx = context({
      subscription: {
        plan: "business",
        status: "canceled",
        graceUntil: "2027-01-01T00:00:00Z",
      },
    });
    expect(effectivePlan(ctx)).toBe("free");
  });
});

describe("getQuota", () => {
  it("คืนค่าตามแพ็กเกจเมื่อไม่มีสิทธิ์พิเศษ", () => {
    expect(getQuota(context(), "dynamic_qr")).toBe(PLAN_QUOTAS.pro.dynamic_qr);
    expect(getQuota(context({ subscription: null }), "dynamic_qr")).toBe(2);
  });

  it("สิทธิ์ที่แจกด้วยมือชนะค่าตามแพ็กเกจ — ใช้กับดีล B2B", () => {
    const ctx = context({
      subscription: { plan: "free", status: "active", graceUntil: null },
      entitlements: [{ feature: "dynamic_qr", quota: 500, expires_at: null }],
    });
    expect(getQuota(ctx, "dynamic_qr")).toBe(500);
  });

  it("quota เป็น null ในตารางแปลว่าไม่จำกัด", () => {
    const ctx = context({
      subscription: { plan: "free", status: "active", graceUntil: null },
      entitlements: [{ feature: "print_pdf", quota: null, expires_at: null }],
    });
    expect(getQuota(ctx, "print_pdf")).toBe(UNLIMITED);
  });

  it("สิทธิ์ที่หมดอายุแล้วถูกมองข้าม ตกกลับไปใช้ค่าตามแพ็กเกจ", () => {
    const ctx = context({
      subscription: { plan: "free", status: "active", graceUntil: null },
      entitlements: [
        {
          feature: "dynamic_qr",
          quota: 500,
          expires_at: "2026-09-01T00:00:00Z",
        },
      ],
    });
    expect(getQuota(ctx, "dynamic_qr")).toBe(2);
  });

  it("สิทธิ์ที่ยังไม่หมดอายุยังใช้ได้", () => {
    const ctx = context({
      subscription: { plan: "free", status: "active", graceUntil: null },
      entitlements: [
        {
          feature: "dynamic_qr",
          quota: 500,
          expires_at: "2026-12-31T00:00:00Z",
        },
      ],
    });
    expect(getQuota(ctx, "dynamic_qr")).toBe(500);
  });
});

describe("hasFeature", () => {
  it("แพ็กเกจฟรีใช้ PDF สำหรับงานพิมพ์ไม่ได้ แต่สร้าง dynamic QR ได้", () => {
    const free = context({ subscription: null });
    expect(hasFeature(free, "print_pdf")).toBe(false);
    expect(hasFeature(free, "dynamic_qr")).toBe(true);
  });

  it("Pro ใช้ได้ทุกฟีเจอร์ในรายการ", () => {
    for (const feature of FEATURES) {
      expect(hasFeature(context(), feature), `Pro ควรใช้ ${feature} ได้`).toBe(
        true,
      );
    }
  });
});

describe("checkQuota", () => {
  it("ยังไม่ถึงเพดานก็สร้างเพิ่มได้", () => {
    const result = checkQuota(context({ subscription: null }), "dynamic_qr", 1);
    expect(result).toEqual({ allowed: true, used: 1, limit: 2, remaining: 1 });
  });

  it("ถึงเพดานแล้วสร้างไม่ได้", () => {
    const result = checkQuota(context({ subscription: null }), "dynamic_qr", 2);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("ใช้เกินเพดาน (เช่นเพิ่งถูกลดแพ็กเกจ) ต้องไม่คืนค่าติดลบ", () => {
    const result = checkQuota(context({ subscription: null }), "dynamic_qr", 9);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("ไม่จำกัดก็สร้างได้เสมอ", () => {
    const ctx = context({
      subscription: { plan: "business", status: "active", graceUntil: null },
    });
    expect(checkQuota(ctx, "dynamic_qr", 10_000).allowed).toBe(true);
  });
});

describe("toContext", () => {
  it("แปลงแถวดิบจากฐานข้อมูลได้", () => {
    const ctx = toContext(
      { plan: "pro", status: "grace", grace_until: "2026-10-01T00:00:00Z" },
      [{ feature: "dynamic_qr", quota: 10, expires_at: null }],
      NOW,
    );
    expect(ctx.subscription?.plan).toBe("pro");
    expect(ctx.subscription?.graceUntil).toBe("2026-10-01T00:00:00Z");
    expect(getQuota(ctx, "dynamic_qr")).toBe(10);
  });

  it("ค่าที่ไม่รู้จักจากฐานข้อมูลถอยไปที่ free ไม่ใช่พัง", () => {
    const ctx = toContext(
      { plan: "แพ็กเกจที่ไม่มีจริง", status: "อะไรก็ไม่รู้", grace_until: null },
      [],
      NOW,
    );
    expect(effectivePlan(ctx)).toBe("free");
  });

  it("กรองฟีเจอร์ที่ไม่รู้จักออก ไม่ให้ข้อมูลเก่าในตารางให้สิทธิ์เกิน", () => {
    const ctx = toContext(
      { plan: "free", status: "active", grace_until: null },
      [{ feature: "ฟีเจอร์ที่ถูกลบไปแล้ว", quota: 999, expires_at: null }],
    );
    expect(ctx.entitlements).toHaveLength(0);
  });
});

describe("ความสอดคล้องของตารางโควตา", () => {
  it("ทุกแพ็กเกจกำหนดครบทุกฟีเจอร์ ไม่มีช่องว่างที่ทำให้ undefined หลุดออกไป", () => {
    for (const plan of PLANS) {
      for (const feature of FEATURES) {
        expect(
          typeof PLAN_QUOTAS[plan][feature],
          `${plan}.${feature} ต้องมีค่า`,
        ).toBe("number");
      }
    }
  });

  it("แพ็กเกจที่แพงกว่าต้องไม่ได้น้อยกว่าแพ็กเกจที่ถูกกว่า", () => {
    for (const feature of FEATURES) {
      expect(PLAN_QUOTAS.pro[feature]).toBeGreaterThanOrEqual(
        PLAN_QUOTAS.free[feature],
      );
      expect(PLAN_QUOTAS.business[feature]).toBeGreaterThanOrEqual(
        PLAN_QUOTAS.pro[feature],
      );
    }
  });

  it("summarize คืนครบทุกฟีเจอร์", () => {
    expect(Object.keys(summarize(context()))).toEqual([...FEATURES]);
  });
});

describe("ชั้นสิทธิ์ต้องไม่รู้จัก payment gateway", () => {
  it("ไม่มีคำที่อ้างถึงผู้ให้บริการชำระเงินในโมดูลนี้", async () => {
    // prd.md §5.1 บังคับไว้ — ถ้าเผลอ import อะไรของ gateway เข้ามา การย้ายเจ้าจะแพงมาก
    // อ่านจาก path ของโปรเจกต์ เพราะ import.meta.url ในสภาพแวดล้อมทดสอบไม่ใช่ file URL
    const source = await readFile("src/lib/billing/entitlements.ts", "utf8");

    for (const banned of [
      "omise",
      "opn",
      "stripe",
      "xendit",
      "2c2p",
      "webhook",
    ]) {
      expect(
        source.toLowerCase().includes(banned),
        `เจอคำว่า "${banned}" ในชั้นสิทธิ์`,
      ).toBe(false);
    }
  });
});
