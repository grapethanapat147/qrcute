import { describe, expect, it } from "vitest";
import { SCAN_RETENTION_DAYS } from "@/lib/legal/privacy";
import { DYNAMIC_LAPSE_DAYS } from "@/lib/qr/dynamic-support";
import { GRACE_DAYS } from "./billing-events";
import { PLAN_QUOTAS } from "./entitlements";
import { formatSatang, PRICES, SELLABLE_PRICE_CODES } from "./plans";
import {
  PRICING_DISCLOSURES,
  PRICING_FAQ,
  PRICING_FEATURES,
  PRICING_PLANS,
} from "./pricing-content";

const allText = JSON.stringify([
  PRICING_PLANS,
  PRICING_FEATURES,
  PRICING_DISCLOSURES,
  PRICING_FAQ,
]);

/**
 * docs/strategy.md เขียนไว้เองว่า "เปิดหน้าราคาที่ขายของที่ยังไม่มี = เสียความเชื่อถือ"
 * และสั่งตัด Business tier, bulk CSV, menu builder, API ออกจาก 9 สัปดาห์แรก
 * test ชุดนี้กันไม่ให้ของพวกนั้นแอบกลับขึ้นหน้าราคาก่อนที่จะมีจริง
 */
describe("หน้าราคาต้องไม่ขายของที่ยังไม่มี", () => {
  it("ไม่โฆษณาฟีเจอร์ที่ถูกตัดออกจาก scope", () => {
    for (const cut of ["CSV", "white-label", "API", "menu builder"]) {
      expect(allText, `พบ "${cut}" บนหน้าราคาทั้งที่ยังไม่มีของ`).not.toContain(cut);
    }
  });

  it("ไม่มีแพ็กเกจที่ยังไม่เปิดขายอยู่บนหน้า", () => {
    const ids = PRICING_PLANS.map((plan) => plan.id);
    expect(ids).not.toContain("business");
    // ทุกแพ็กเกจที่มีราคาต้องอยู่ในรายการที่ขายได้จริง
    for (const code of ["pro_monthly", "pro_yearly", "pro_lifetime"] as const) {
      expect(SELLABLE_PRICE_CODES).toContain(code);
    }
  });
});

describe("ตัวเลขบนหน้าราคาตรงกับระบบ", () => {
  it("ราคาทุกตัวตรงกับ plans.ts", () => {
    const shown = PRICING_PLANS.map((plan) => plan.price);

    expect(shown).toContain(formatSatang(PRICES.pro_monthly.amountSatang));
    expect(shown).toContain(formatSatang(PRICES.pro_yearly.amountSatang));
    expect(shown).toContain(formatSatang(PRICES.pro_lifetime.amountSatang));
  });

  it("โควตา dynamic QR ตรงกับ PLAN_QUOTAS", () => {
    const row = PRICING_FEATURES.find((f) => f.label.includes("แก้ปลายทางได้"));

    expect(row?.free).toContain(`${PLAN_QUOTAS.free.dynamic_qr}`);
    expect(row?.pro).toContain(`${PLAN_QUOTAS.pro.dynamic_qr}`);
  });

  /**
   * ⚠️ ใช้ SCAN_RETENTION_DAYS ไม่ใช่ PLAN_QUOTAS.analytics_days โดยตั้งใจ
   * เพราะข้อมูลดิบถูกลบตาม SCAN_RETENTION_DAYS จริง ส่วน analytics_days
   * เป็นภาพปลายทางที่ต้องมีตารางสรุปรายวันก่อนถึงจะทำได้
   * โฆษณาตัวเลขที่ระบบยังส่งมอบไม่ได้คือการขายของที่ยังไม่มี
   */
  it("สถิติการสแกนโฆษณาตามระยะที่เก็บข้อมูลจริง", () => {
    const row = PRICING_FEATURES.find((f) => f.label.includes("สถิติการสแกน"));

    expect(row?.free).toContain(`${SCAN_RETENTION_DAYS.free}`);
    expect(row?.pro).toContain(`${SCAN_RETENTION_DAYS.pro}`);
    expect(row?.pro).not.toContain(`${PLAN_QUOTAS.pro.analytics_days}`);
  });
});

describe("สิ่งที่ต้องบอกก่อนคนกดซื้อ", () => {
  /** business invariant ข้อ 3 */
  it("บอกผลของการเลิกจ่ายพร้อมตัวเลขที่ตรงกับ ADR 0008", () => {
    const text = JSON.stringify(PRICING_DISCLOSURES);

    expect(text).toContain(`${GRACE_DAYS}`);
    expect(text).toContain(`${DYNAMIC_LAPSE_DAYS}`);
    expect(text).toContain("ไม่ถูกลบ");
  });

  /** ADR 0007 — ข้อค้นพบที่เปลี่ยนโจทย์ทั้งหมด ต้องอยู่บนหน้าราคา */
  it("บอกว่าพร้อมเพย์แก้ปลายทางไม่ได้ทุกแพ็กเกจ", () => {
    const text = JSON.stringify(PRICING_DISCLOSURES);

    expect(text).toContain("พร้อมเพย์");
    expect(text).toContain("จ่ายเท่าไรก็ทำไม่ได้");
  });

  it("บอกว่าจ่ายครั้งเดียวจะไม่ถูกเรียกเก็บเพิ่ม", () => {
    expect(allText).toContain("จ่ายครั้งเดียวจริง");
  });
});
