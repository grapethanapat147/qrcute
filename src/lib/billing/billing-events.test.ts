import { describe, expect, it } from "vitest";
import {
  applyIntent,
  FREE_STATE,
  type GatewayEvent,
  GRACE_DAYS,
  type SubscriptionState,
  toIntent,
} from "./billing-events";
import { effectivePlan } from "./entitlements";

const PAID_AT = new Date("2026-09-07T10:00:00Z");

function event(overrides: Partial<GatewayEvent> = {}): GatewayEvent {
  return {
    id: "evnt_test_1",
    key: "charge.complete",
    createdAt: PAID_AT,
    chargeStatus: "successful",
    priceCode: "pro_monthly",
    ...overrides,
  };
}

describe("toIntent", () => {
  it("จ่ายสำเร็จ = เปิดสิทธิ์ตามรหัสสินค้า", () => {
    expect(toIntent(event())).toEqual({
      type: "activate",
      plan: "pro",
      billingKind: "monthly",
      paidAt: PAID_AT,
    });
  });

  it("จ่ายไม่สำเร็จ = เข้าสู่ช่วงผ่อนผัน", () => {
    expect(toIntent(event({ chargeStatus: "failed" }))).toEqual({
      type: "payment_failed",
      failedAt: PAID_AT,
    });
  });

  it("charge ที่ยังไม่จบต้องไม่เปลี่ยนอะไร", () => {
    expect(toIntent(event({ chargeStatus: "pending" })).type).toBe("ignore");
  });

  it("จ่ายสำเร็จแต่ไม่รู้ว่าซื้ออะไร ต้องไม่เดา", () => {
    const result = toIntent(event({ priceCode: undefined }));
    expect(result.type).toBe("ignore");
    expect(toIntent(event({ priceCode: "ของที่ไม่มีขาย" })).type).toBe("ignore");
  });

  it("เหตุการณ์ที่ยังไม่รองรับถูกข้ามไปพร้อมเหตุผล", () => {
    const result = toIntent(event({ key: "schedule.create" }));
    expect(result).toEqual({
      type: "ignore",
      reason: "ยังไม่รองรับเหตุการณ์ schedule.create",
    });
  });
});

describe("ยิงเหตุการณ์เดิมซ้ำ (prd.md §5.1)", () => {
  it("ยิงซ้ำ 3 ครั้งได้สถานะเท่าเดิมทุกครั้ง", () => {
    const intent = toIntent(event());
    const once = applyIntent(FREE_STATE, intent);
    const twice = applyIntent(once, intent);
    const thrice = applyIntent(twice, intent);

    expect(twice).toEqual(once);
    expect(thrice).toEqual(once);
  });

  it("ยิงเหตุการณ์จ่ายไม่สำเร็จซ้ำ ไม่ทบวันผ่อนผันเพิ่ม", () => {
    // ถ้าเผลอเขียนเป็นบวกวันสะสม ลูกค้าจะยืดเวลาได้ด้วยการยิงซ้ำ
    const intent = toIntent(event({ chargeStatus: "failed" }));
    const paid = applyIntent(FREE_STATE, toIntent(event()));

    const once = applyIntent(paid, intent);
    const twice = applyIntent(once, intent);

    expect(twice.graceUntil?.toISOString()).toBe(
      once.graceUntil?.toISOString(),
    );
  });

  it("ช่วงผ่อนผันยาวตามที่กำหนดไว้ใน ADR 0008", () => {
    const paid = applyIntent(FREE_STATE, toIntent(event()));
    const failed = applyIntent(
      paid,
      toIntent(event({ chargeStatus: "failed" })),
    );
    const days =
      ((failed.graceUntil?.getTime() ?? 0) - PAID_AT.getTime()) / 86_400_000;
    expect(days).toBe(GRACE_DAYS);
  });
});

describe("คนที่ซื้อแบบจ่ายครั้งเดียว (prd.md §5.1)", () => {
  const lifetime: SubscriptionState = applyIntent(
    FREE_STATE,
    toIntent(event({ priceCode: "pro_lifetime" })),
  );

  it("จ่ายครั้งเดียวแล้วไม่มีวันหมดอายุ", () => {
    expect(lifetime.billingKind).toBe("lifetime");
    expect(lifetime.currentPeriodEnd).toBeNull();
    expect(lifetime.status).toBe("active");
  });

  it("เหตุการณ์เก็บเงินไม่สำเร็จของ subscription อื่น ต้องไม่ลดสิทธิ์เขา", () => {
    const after = applyIntent(
      lifetime,
      toIntent(event({ chargeStatus: "failed" })),
    );
    expect(after).toEqual(lifetime);
  });

  it("การยกเลิกที่หลุดมาต้องไม่ลดสิทธิ์เขา", () => {
    expect(applyIntent(lifetime, { type: "cancel" })).toEqual(lifetime);
  });

  it("รายการรายเดือนที่มาทีหลังต้องไม่ทำให้เสียสิทธิ์ตลอดชีพ", () => {
    const after = applyIntent(lifetime, toIntent(event()));
    expect(after.billingKind).toBe("lifetime");
    expect(after.currentPeriodEnd).toBeNull();
  });

  it("แต่ยังอัปเกรดจาก Pro ตลอดชีพเป็น Business ตลอดชีพได้", () => {
    const after = applyIntent(
      lifetime,
      toIntent(event({ priceCode: "business_lifetime" })),
    );
    expect(after.plan).toBe("business");
  });
});

describe("เชื่อมกับชั้นสิทธิ์", () => {
  function toEntitlementContext(state: SubscriptionState, now: Date) {
    return {
      subscription: {
        plan: state.plan,
        status: state.status,
        graceUntil: state.graceUntil?.toISOString() ?? null,
      },
      entitlements: [],
      now,
    };
  }

  it("ระหว่างผ่อนผันยังได้สิทธิ์ Pro", () => {
    const paid = applyIntent(FREE_STATE, toIntent(event()));
    const failed = applyIntent(
      paid,
      toIntent(event({ chargeStatus: "failed" })),
    );
    const duringGrace = new Date("2026-09-20T00:00:00Z");
    expect(effectivePlan(toEntitlementContext(failed, duringGrace))).toBe(
      "pro",
    );
  });

  it("พ้นช่วงผ่อนผันแล้วตกเป็น free", () => {
    const paid = applyIntent(FREE_STATE, toIntent(event()));
    const failed = applyIntent(
      paid,
      toIntent(event({ chargeStatus: "failed" })),
    );
    const afterGrace = new Date("2026-10-20T00:00:00Z");
    expect(effectivePlan(toEntitlementContext(failed, afterGrace))).toBe(
      "free",
    );
  });

  it("คนจ่ายครั้งเดียวยังเป็น Pro แม้เวลาผ่านไปนาน", () => {
    const lifetime = applyIntent(
      FREE_STATE,
      toIntent(event({ priceCode: "pro_lifetime" })),
    );
    const muchLater = new Date("2030-01-01T00:00:00Z");
    expect(effectivePlan(toEntitlementContext(lifetime, muchLater))).toBe(
      "pro",
    );
  });
});
