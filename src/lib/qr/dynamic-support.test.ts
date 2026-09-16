import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { GRACE_DAYS } from "@/lib/billing/billing-events";
import {
  canBeDynamic,
  DYNAMIC_GRACE_DAYS,
  DYNAMIC_LAPSE_DAYS,
  DYNAMIC_LAPSE_NOTICE,
} from "./dynamic-support";

describe("ประเภทที่ทำ dynamic ได้", () => {
  it("url กับ line ทำได้", () => {
    expect(canBeDynamic("url")).toBe(true);
    expect(canBeDynamic("line")).toBe(true);
  });

  it("ประเภทที่เครื่องอ่านต้องอ่าน payload ตรง ๆ ทำไม่ได้", () => {
    expect(canBeDynamic("promptpay")).toBe(false);
    expect(canBeDynamic("wifi")).toBe(false);
    expect(canBeDynamic("vcard")).toBe(false);
  });
});

/**
 * business invariant ข้อ 3 บอกว่าต้องบอกผลของการเลิกจ่ายก่อนผู้ใช้สร้าง
 * ถ้าตัวเลขในข้อความไม่ตรงกับพฤติกรรมจริง เท่ากับเราโกหกคนที่กำลังจะพิมพ์ป้าย
 */
describe("คำเตือนก่อนสร้าง dynamic QR ต้องตรงกับพฤติกรรมจริง", () => {
  it("จำนวนวันผ่อนผันตรงกับที่ระบบใช้จริง", () => {
    expect(DYNAMIC_GRACE_DAYS).toBe(GRACE_DAYS);
    expect(DYNAMIC_LAPSE_NOTICE).toContain(`${GRACE_DAYS} วัน`);
  });

  it("วันที่หยุดทำงานตรงกับ interval ใน migration", async () => {
    const sql = await readFile(
      "supabase/migrations/20260907150000_suspend.sql",
      "utf8",
    );
    const match = sql.match(/interval '(\d+) days'/);

    expect(match, "หาไม่เจอว่า SQL ตั้งไว้กี่วัน").not.toBeNull();
    expect(Number(match?.[1])).toBe(DYNAMIC_LAPSE_DAYS);
    expect(DYNAMIC_LAPSE_NOTICE).toContain(`${DYNAMIC_LAPSE_DAYS} วัน`);
  });

  it("ต้องบอกว่าข้อมูลไม่ถูกลบ ไม่งั้นคนจะกลัวจนไม่กล้าใช้", () => {
    expect(DYNAMIC_LAPSE_NOTICE).toContain("ไม่ถูกลบ");
    expect(DYNAMIC_LAPSE_NOTICE).toContain("กลับมาจ่าย");
  });
});
