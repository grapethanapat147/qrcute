import { describe, expect, it } from "vitest";
import { COMPARISONS } from "./comparisons";

describe("หน้าเปรียบเทียบ", () => {
  it("ทุกคู่แข่งมีแหล่งที่มาเป็นหน้าทางการของเขาและวันที่ตรวจ", () => {
    for (const item of COMPARISONS) {
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      expect(Number.isNaN(new Date(item.checkedAt).getTime())).toBe(false);
    }
  });

  it("ทุกหน้าบอกด้วยว่าเมื่อไรควรเลือกเขา — หน้าเปรียบเทียบที่ชมแต่ตัวเองไม่มีใครเชื่อ", () => {
    for (const item of COMPARISONS) {
      expect(item.chooseThem.length, item.slug).toBeGreaterThan(0);
    }
  });

  it("ไม่ใช้คำกล่าวหาคู่แข่ง", () => {
    const text = JSON.stringify(COMPARISONS);
    for (const word of ["หลอก", "โกง", "ต้มตุ๋น", "แย่ที่สุด"]) {
      expect(text, word).not.toContain(word);
    }
  });

  it("slug และ title ไม่ซ้ำกัน", () => {
    expect(new Set(COMPARISONS.map((c) => c.slug)).size).toBe(
      COMPARISONS.length,
    );
    expect(new Set(COMPARISONS.map((c) => c.title)).size).toBe(
      COMPARISONS.length,
    );
  });
});
