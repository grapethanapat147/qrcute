import { describe, expect, it } from "vitest";
import { provinceName, TH_PROVINCE_NAMES } from "./provinces";

describe("TH_PROVINCE_NAMES", () => {
  it("ครบ 77 จังหวัด บวกพัทยาที่ ISO แยกเป็นเขตพิเศษ", () => {
    expect(Object.keys(TH_PROVINCE_NAMES)).toHaveLength(78);
  });

  it("ไม่มีชื่อจังหวัดซ้ำกัน", () => {
    const names = Object.values(TH_PROVINCE_NAMES);
    expect(new Set(names).size).toBe(names.length);
  });

  it("ทุกชื่อเป็นภาษาไทย ไม่มีอังกฤษหลุด", () => {
    for (const [code, name] of Object.entries(TH_PROVINCE_NAMES)) {
      expect(/^[฀-๿\s]+$/.test(name), `${code} = ${name}`).toBe(true);
    }
  });
});

describe("provinceName", () => {
  it("แปลงรหัสของไทยเป็นชื่อจังหวัด", () => {
    expect(provinceName("10", "TH")).toBe("กรุงเทพมหานคร");
    expect(provinceName("83", "TH")).toBe("ภูเก็ต");
    expect(provinceName("S", "TH")).toBe("พัทยา");
  });

  it("ไม่สนตัวพิมพ์เล็กใหญ่และช่องว่างส่วนเกิน", () => {
    expect(provinceName(" s ", "TH")).toBe("พัทยา");
  });

  it("รหัสไทยที่ไม่รู้จักคืนค่าเดิม ดีกว่าทิ้งข้อมูล", () => {
    expect(provinceName("99", "TH")).toBe("99");
  });

  it("ต่างประเทศแสดงรหัสประเทศนำหน้า", () => {
    expect(provinceName("13", "JP")).toBe("JP · 13");
  });

  it("ไม่มีข้อมูลคืน null", () => {
    expect(provinceName(null, "TH")).toBeNull();
    expect(provinceName("  ", "TH")).toBeNull();
  });
});
