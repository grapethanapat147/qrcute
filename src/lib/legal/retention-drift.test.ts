import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { GRACE_DAYS } from "@/lib/billing/billing-events";
import { PLAN_QUOTAS } from "@/lib/billing/entitlements";
import { DYNAMIC_LAPSE_DAYS } from "@/lib/qr/dynamic-support";
import { LEGAL_DOCUMENTS } from ".";
import { SCAN_RETENTION_DAYS } from "./privacy";
import { REFUND_WINDOW_DAYS } from "./refund";

const INIT_MIGRATION = "supabase/migrations/20260906120000_init.sql";

/**
 * เอกสารกฎหมายผูกพันจริง ตัวเลขที่ประกาศไว้จึงต้องตรงกับสิ่งที่ระบบทำ
 * test ชุดนี้จับกรณีที่แก้โค้ดแล้วลืมแก้เอกสาร ซึ่งเป็นความเสี่ยงทางกฎหมาย
 * ไม่ใช่แค่เอกสารไม่อัปเดต
 */
describe("ระยะเก็บข้อมูลในนโยบายต้องตรงกับที่ลบจริง", () => {
  it("ตัวเลขทุกระดับตรงกับ delete_expired_scans()", async () => {
    const sql = await readFile(INIT_MIGRATION, "utf8");

    const business = sql.match(
      /when 'business' then interval '(\d+) days'/,
    )?.[1];
    const pro = sql.match(/when 'pro' then interval '(\d+) days'/)?.[1];
    const fallback = sql.match(/else interval '(\d+) days'/)?.[1];

    expect(Number(business)).toBe(SCAN_RETENTION_DAYS.business);
    expect(Number(pro)).toBe(SCAN_RETENTION_DAYS.pro);
    expect(Number(fallback)).toBe(SCAN_RETENTION_DAYS.free);
  });

  /**
   * ⚠️ ข้อนี้ล้มเหลวโดยตั้งใจไม่ได้ — มันบันทึกช่องว่างที่รู้อยู่แล้วไว้เป็นโค้ด
   * ADR 0006 ออกแบบให้ Pro/Business ดูสถิติย้อนหลังได้นานกว่าระยะเก็บแถวดิบ
   * โดยเก็บเป็น "สรุปรายวัน" แทน แต่ตารางสรุปรายวันยังไม่ได้ทำ
   * ถ้าวันหนึ่งทำแล้ว ให้ลบ test นี้ทิ้งพร้อมอัปเดตนโยบายความเป็นส่วนตัว
   */
  it("บันทึกไว้ว่าหน้าต่างดูสถิติยังยาวกว่าระยะเก็บแถวดิบอยู่", () => {
    expect(PLAN_QUOTAS.pro.analytics_days).toBeGreaterThan(
      SCAN_RETENTION_DAYS.pro,
    );
    expect(PLAN_QUOTAS.business.analytics_days).toBeGreaterThan(
      SCAN_RETENTION_DAYS.business,
    );
  });
});

describe("ตัวเลขอื่นในเอกสารกฎหมาย", () => {
  const terms = LEGAL_DOCUMENTS.find((doc) => doc.slug === "terms");
  const allText = JSON.stringify(LEGAL_DOCUMENTS);

  it("เงื่อนไขการใช้งานอ้างลำดับเวลาการลดระดับตรงกับ ADR 0008", () => {
    expect(terms).toBeDefined();
    expect(JSON.stringify(terms)).toContain(`${GRACE_DAYS}`);
    expect(JSON.stringify(terms)).toContain(`${DYNAMIC_LAPSE_DAYS}`);
  });

  it("นโยบายคืนเงินบอกจำนวนวันตรงกับค่าที่ตั้งไว้", () => {
    expect(allText).toContain(`${REFUND_WINDOW_DAYS} วัน`);
  });

  it("ทุกฉบับมีวันที่มีผลบังคับใช้ที่อ่านเป็นวันที่ได้จริง", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      expect(
        Number.isNaN(new Date(doc.effectiveDate).getTime()),
        `${doc.slug} วันที่ไม่ถูกต้อง`,
      ).toBe(false);
    }
  });

  it("ทุกฉบับมีช่องทางติดต่อ", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      expect(JSON.stringify(doc), `${doc.slug} ไม่มีอีเมลติดต่อ`).toContain("@");
    }
  });
});
