import { describe, expect, it } from "vitest";
import {
  CHECKOUT_REJECTION_MESSAGES,
  LIFETIME_SEAT_LIMIT,
  startCheckout,
} from "./checkout";
import { parseOpnEvent } from "./opn/event";
import { PRICES } from "./plans";

const OWNER = "3f1c0b6a-9d2e-4a7b-8c5d-1e2f3a4b5c6d";
const CHECKOUT = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function start(priceCode: string, hasActiveLifetime = false, lifetimeSold = 0) {
  return startCheckout({
    checkoutId: CHECKOUT,
    ownerId: OWNER,
    priceCode,
    hasActiveLifetime,
    lifetimeSold,
  });
}

describe("startCheckout", () => {
  it("ประกอบคำขอชำระเงินจากราคาในระบบ", () => {
    const result = start("pro_monthly");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.amountSatang).toBe(PRICES.pro_monthly.amountSatang);
    expect(result.intent.currency).toBe("THB");
    expect(result.intent.requiresCard).toBe(true);
  });

  it("แพ็กเกจจ่ายครั้งเดียวไม่บังคับใช้บัตร — จ่ายด้วยพร้อมเพย์ได้", () => {
    const result = start("pro_lifetime");
    expect(result.ok && result.intent.requiresCard).toBe(false);
  });

  it("ปฏิเสธรหัสที่ไม่มีอยู่จริง", () => {
    expect(start("pro_forever")).toEqual({
      ok: false,
      reason: "unknown_price",
    });
  });

  it("ปฏิเสธแพ็กเกจที่ยังไม่เปิดขาย", () => {
    expect(start("business_monthly")).toEqual({
      ok: false,
      reason: "not_for_sale",
    });
  });

  it("ปฏิเสธแพ็กเกจฟรี — ไม่มีอะไรให้เก็บเงิน", () => {
    const result = start("free_monthly");
    expect(result.ok).toBe(false);
  });

  /**
   * applyIntent กันไม่ให้คนซื้อ lifetime ถูกลดระดับอยู่แล้ว
   * แต่ไม่ได้กันการเก็บเงินซ้ำ — ถ้าไม่กันตรงนี้ เขาจะเสียเงินฟรี ๆ
   */
  it("ไม่ให้คนที่จ่ายครั้งเดียวไปแล้วถูกเก็บเงินซ้ำ", () => {
    for (const code of ["pro_monthly", "pro_yearly", "pro_lifetime"]) {
      expect(start(code, true)).toEqual({
        ok: false,
        reason: "already_lifetime",
      });
    }
  });

  describe("จำกัดสิทธิ์จ่ายครั้งเดียว (docs/strategy.md §5)", () => {
    it("ยังขายได้ตอนเหลือสิทธิ์สุดท้าย", () => {
      expect(start("pro_lifetime", false, LIFETIME_SEAT_LIMIT - 1).ok).toBe(
        true,
      );
    });

    it("ครบแล้วต้องปิดขาย ไม่งั้นหน้าราคาโกหก", () => {
      expect(start("pro_lifetime", false, LIFETIME_SEAT_LIMIT)).toEqual({
        ok: false,
        reason: "sold_out",
      });
    });

    it("ครบสิทธิ์แล้วยังสมัครรายเดือนรายปีได้ตามปกติ", () => {
      expect(start("pro_monthly", false, LIFETIME_SEAT_LIMIT).ok).toBe(true);
      expect(start("pro_yearly", false, LIFETIME_SEAT_LIMIT + 50).ok).toBe(
        true,
      );
    });
  });

  it("ทุกเหตุผลที่ปฏิเสธมีข้อความภาษาไทยให้ผู้ใช้", () => {
    for (const message of Object.values(CHECKOUT_REJECTION_MESSAGES)) {
      expect(message.length).toBeGreaterThan(0);
    }
  });
});

/**
 * test ที่สำคัญที่สุดในไฟล์นี้
 *
 * ถ้า metadata ที่ checkout ส่งไป กับที่ webhook อ่านกลับมา สะกดคีย์ไม่ตรงกัน
 * เงินจะเข้าบัญชีเราแต่สิทธิ์ของลูกค้าไม่เปิด และไม่มี error ใด ๆ ให้เห็น
 * test นี้จำลองว่า Opn ส่ง metadata ที่เราแนบไปกลับมาในเหตุการณ์ แล้วให้ parser
 * ตัวจริงอ่าน — ถ้าอ่านไม่ออก test จะแดงก่อนลูกค้าคนแรกจะเจอ
 */
describe("สัญญาระหว่าง checkout กับ webhook", () => {
  it("webhook อ่าน metadata ที่ checkout แนบไปได้ครบ", () => {
    const result = start("pro_yearly");
    if (!result.ok) throw new Error("ควรสร้างคำขอได้");

    const parsed = parseOpnEvent(
      JSON.stringify({
        object: "event",
        id: "evnt_contract_1",
        livemode: false,
        key: "charge.complete",
        created_at: "2026-10-01T10:00:00Z",
        data: {
          object: "charge",
          id: "chrg_contract_1",
          amount: result.intent.amountSatang,
          currency: "thb",
          status: "successful",
          metadata: result.intent.metadata,
        },
      }),
    );

    expect(parsed?.charge?.ownerId).toBe(OWNER);
    expect(parsed?.charge?.priceCode).toBe("pro_yearly");
    expect(parsed?.event.priceCode).toBe("pro_yearly");
  });
});
