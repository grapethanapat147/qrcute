import { describe, expect, it } from "vitest";
import { parseOpnEvent } from "./event";

const OWNER = "3f1c0b6a-9d2e-4a7b-8c5d-1e2f3a4b5c6d";

function body(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    object: "event",
    id: "evnt_test_1",
    livemode: false,
    location: "/events/evnt_test_1",
    key: "charge.complete",
    created_at: "2026-09-07T10:00:00Z",
    data: {
      object: "charge",
      id: "chrg_test_1",
      amount: 14_900,
      currency: "thb",
      status: "successful",
      paid_at: "2026-09-07T09:59:58Z",
      metadata: { owner_id: OWNER, price_code: "pro_monthly" },
    },
    ...overrides,
  });
}

describe("parseOpnEvent", () => {
  it("แกะเหตุการณ์จ่ายเงินสำเร็จได้ครบ", () => {
    const parsed = parseOpnEvent(body());

    expect(parsed?.event).toEqual({
      id: "evnt_test_1",
      key: "charge.complete",
      createdAt: new Date("2026-09-07T10:00:00Z"),
      chargeStatus: "successful",
      priceCode: "pro_monthly",
    });
    expect(parsed?.charge).toEqual({
      chargeId: "chrg_test_1",
      status: "successful",
      amountSatang: 14_900,
      currency: "THB",
      paidAt: new Date("2026-09-07T09:59:58Z"),
      ownerId: OWNER,
      priceCode: "pro_monthly",
    });
    expect(parsed?.livemode).toBe(false);
  });

  it("body ที่ไม่ใช่ JSON ต้องไม่ทำให้ระเบิด", () => {
    expect(parseOpnEvent("ไม่ใช่ json")).toBeNull();
    expect(parseOpnEvent("")).toBeNull();
    expect(parseOpnEvent("[1,2,3]")).toBeNull();
  });

  it("ขาดฟิลด์ที่ระบุตัวเหตุการณ์ = แกะไม่ได้", () => {
    expect(parseOpnEvent(body({ id: undefined }))).toBeNull();
    expect(parseOpnEvent(body({ key: undefined }))).toBeNull();
    expect(parseOpnEvent(body({ created_at: "ไม่ใช่วันที่" }))).toBeNull();
  });

  it("เหตุการณ์ที่ไม่ได้เกี่ยวกับ charge ยังแกะซองได้ แต่ไม่มี charge", () => {
    const parsed = parseOpnEvent(
      body({
        key: "customer.create",
        data: { object: "customer", id: "cust_1" },
      }),
    );

    expect(parsed?.event.key).toBe("customer.create");
    expect(parsed?.charge).toBeNull();
    expect(parsed?.event.chargeStatus).toBeUndefined();
  });

  it("owner_id ที่ไม่ใช่ UUID ต้องถูกทิ้ง ไม่เอาไปยิง query", () => {
    const parsed = parseOpnEvent(
      body({
        data: {
          object: "charge",
          id: "chrg_test_1",
          amount: 14_900,
          currency: "thb",
          status: "successful",
          metadata: { owner_id: "' or 1=1 --", price_code: "pro_monthly" },
        },
      }),
    );

    expect(parsed?.charge?.ownerId).toBeNull();
  });

  it("รหัสสินค้าที่ไม่มีในรายการต้องไม่ถูกส่งต่อ", () => {
    const parsed = parseOpnEvent(
      body({
        data: {
          object: "charge",
          id: "chrg_test_1",
          amount: 100,
          currency: "thb",
          status: "successful",
          metadata: { owner_id: OWNER, price_code: "pro_forever" },
        },
      }),
    );

    expect(parsed?.charge?.priceCode).toBeNull();
    expect(parsed?.event.priceCode).toBeUndefined();
  });

  it("charge ที่ไม่มี metadata ยังบันทึกยอดเงินได้ แค่ไม่รู้เจ้าของ", () => {
    const parsed = parseOpnEvent(
      body({
        data: {
          object: "charge",
          id: "chrg_test_1",
          amount: 39_0000,
          currency: "thb",
          status: "successful",
        },
      }),
    );

    expect(parsed?.charge?.amountSatang).toBe(390_000);
    expect(parsed?.charge?.ownerId).toBeNull();
  });

  it("livemode เป็นจริงเฉพาะเมื่อส่งค่า true มาจริง ๆ", () => {
    expect(parseOpnEvent(body({ livemode: true }))?.livemode).toBe(true);
    expect(parseOpnEvent(body({ livemode: "true" }))?.livemode).toBe(false);
    expect(parseOpnEvent(body({ livemode: undefined }))?.livemode).toBe(false);
  });
});
