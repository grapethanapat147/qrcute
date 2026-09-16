import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PLAN_QUOTAS } from "./entitlements";

/**
 * โควตา dynamic QR ของแพ็กเกจฟรีถูกเขียนไว้สองที่
 *
 * source of truth คือ PLAN_QUOTAS ใน entitlements.ts แต่การพัก QR ตอนลูกค้าเลิกจ่าย
 * ทำใน SQL (docs/decisions/0008-downgrade-behaviour.md) จึงต้องรู้ตัวเลขนี้ด้วย
 *
 * ถ้าสองที่นี้ไม่ตรงกัน อาการจะเงียบและร้ายมาก: เราจะพัก QR ของลูกค้ามากหรือน้อย
 * เกินกว่าที่หน้าเว็บบอกไว้ ซึ่งแปลว่าป้ายหน้าร้านของคนที่ยังอยู่ในสิทธิ์ดับไปเฉย ๆ
 * test นี้มีไว้จับกรณีนั้นตั้งแต่ตอน commit
 */
const MIGRATION = "supabase/migrations/20260907150000_suspend.sql";

describe("โควตาฟรีใน SQL กับใน TypeScript ต้องตรงกัน", () => {
  it("free_dynamic_qr_quota() คืนค่าเดียวกับ PLAN_QUOTAS.free.dynamic_qr", async () => {
    const sql = await readFile(MIGRATION, "utf8");
    const match = sql.match(
      /create function public\.free_dynamic_qr_quota\(\)[\s\S]*?as \$\$ select (\d+) \$\$/,
    );

    expect(match, "หาไม่เจอว่า SQL ประกาศโควตาฟรีไว้เท่าไร").not.toBeNull();
    expect(Number(match?.[1])).toBe(PLAN_QUOTAS.free.dynamic_qr);
  });
});
