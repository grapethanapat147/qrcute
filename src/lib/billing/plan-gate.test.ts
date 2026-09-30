import { describe, expect, it } from "vitest";
import { PLAN_QUOTAS } from "./entitlements";
import {
  GENERATOR_GATED_FEATURES,
  planAllows,
  UPGRADE_PROMPT,
} from "./plan-gate";

describe("planAllows", () => {
  it("ฟรีใช้ฟีเจอร์ที่กั้นไว้ไม่ได้", () => {
    for (const feature of GENERATOR_GATED_FEATURES) {
      expect(planAllows("free", feature), feature).toBe(false);
    }
  });

  it("Pro และ Business ใช้ได้ทุกตัวที่กั้นไว้", () => {
    for (const feature of GENERATOR_GATED_FEATURES) {
      expect(planAllows("pro", feature), feature).toBe(true);
      expect(planAllows("business", feature), feature).toBe(true);
    }
  });

  /**
   * ถ้าวันหนึ่งเปลี่ยนใจให้ฟรีใช้ PDF ได้ ต้องแก้ทั้งตารางโควตา หน้าราคา
   * และการกั้นตรงนี้พร้อมกัน test นี้บังคับให้เห็นว่ามีที่อื่นต้องแก้ด้วย
   */
  it("รายการที่กั้นต้องเป็นฟีเจอร์ที่ฟรีมีโควตา 0 จริง", () => {
    for (const feature of GENERATOR_GATED_FEATURES) {
      expect(PLAN_QUOTAS.free[feature], feature).toBe(0);
    }
  });

  it("ทุกฟีเจอร์ที่กั้นมีข้อความชวนอัปเกรด", () => {
    for (const feature of GENERATOR_GATED_FEATURES) {
      expect(UPGRADE_PROMPT[feature].title).not.toBe("");
      expect(UPGRADE_PROMPT[feature].detail).not.toBe("");
    }
  });

  it("ข้อความชวนอัปเกรดบอกว่าได้อะไร ไม่ใช่ตำหนิว่าถูกห้าม", () => {
    for (const feature of GENERATOR_GATED_FEATURES) {
      const text = `${UPGRADE_PROMPT[feature].title}${UPGRADE_PROMPT[feature].detail}`;
      for (const scold of ["ห้าม", "ไม่อนุญาต", "คุณไม่มีสิทธิ์"]) {
        expect(text, `${feature} ใช้คำตำหนิ "${scold}"`).not.toContain(scold);
      }
    }
  });
});
