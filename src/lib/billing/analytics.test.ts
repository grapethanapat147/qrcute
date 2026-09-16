import { describe, expect, it } from "vitest";
import {
  dailyCounts,
  deviceBreakdown,
  referrerBreakdown,
  regionBreakdown,
  type ScanRow,
  splitBots,
  topQrCodes,
} from "./analytics";

const NOW = new Date("2026-09-07T12:00:00Z");

function scan(overrides: Partial<ScanRow> = {}): ScanRow {
  return {
    qr_code_id: "qr-1",
    scanned_at: "2026-09-07T08:00:00Z",
    country: "TH",
    region: "กรุงเทพมหานคร",
    device_type: "mobile",
    referrer_host: null,
    ...overrides,
  };
}

describe("dailyCounts", () => {
  it("เติมวันที่ไม่มีการสแกนเป็นศูนย์ ไม่ให้กราฟหลอกตา", () => {
    const result = dailyCounts([scan()], 3, NOW);
    expect(result).toEqual([
      { date: "2026-09-05", count: 0 },
      { date: "2026-09-06", count: 0 },
      { date: "2026-09-07", count: 1 },
    ]);
  });

  it("เรียงจากเก่าไปใหม่ วันล่าสุดอยู่ท้าย", () => {
    const result = dailyCounts([], 7, NOW);
    expect(result).toHaveLength(7);
    expect(result[0]?.date).toBe("2026-09-01");
    expect(result.at(-1)?.date).toBe("2026-09-07");
  });

  it("นับหลายครั้งในวันเดียวกันรวมกัน", () => {
    const scans = [
      scan({ scanned_at: "2026-09-07T01:00:00Z" }),
      scan({ scanned_at: "2026-09-07T23:00:00Z" }),
    ];
    expect(dailyCounts(scans, 1, NOW)).toEqual([
      { date: "2026-09-07", count: 2 },
    ]);
  });

  it("การสแกนที่เก่ากว่าช่วงที่ขอไม่ถูกนับ", () => {
    const old = scan({ scanned_at: "2026-08-01T00:00:00Z" });
    const total = dailyCounts([old], 7, NOW).reduce(
      (sum, d) => sum + d.count,
      0,
    );
    expect(total).toBe(0);
  });
});

describe("deviceBreakdown", () => {
  it("แปลชื่ออุปกรณ์เป็นภาษาไทยและเรียงจากมากไปน้อย", () => {
    const scans = [
      scan({ device_type: "mobile" }),
      scan({ device_type: "mobile" }),
      scan({ device_type: "desktop" }),
    ];
    const result = deviceBreakdown(scans);
    expect(result[0]).toEqual({ label: "มือถือ", count: 2, share: 2 / 3 });
    expect(result[1]?.label).toBe("คอมพิวเตอร์");
  });

  it("ค่าที่ไม่รู้จักถูกจัดเป็นไม่ทราบ ไม่หลุดเป็นค่าดิบ", () => {
    expect(deviceBreakdown([scan({ device_type: "อะไรไม่รู้" })])[0]?.label).toBe(
      "ไม่ทราบ",
    );
    expect(deviceBreakdown([scan({ device_type: null })])[0]?.label).toBe(
      "ไม่ทราบ",
    );
  });
});

describe("regionBreakdown", () => {
  it("จัดกลุ่มตามจังหวัดและคิดสัดส่วน", () => {
    const scans = [
      scan({ region: "เชียงใหม่" }),
      scan({ region: "เชียงใหม่" }),
      scan({ region: "ภูเก็ต" }),
      scan({ region: null }),
    ];
    const result = regionBreakdown(scans);
    expect(result[0]).toEqual({ label: "เชียงใหม่", count: 2, share: 0.5 });
    expect(result.map((r) => r.label)).toContain("ไม่ระบุพื้นที่");
  });
});

describe("referrerBreakdown", () => {
  it("ไม่มี referrer แปลว่าสแกนจากป้ายโดยตรง", () => {
    expect(referrerBreakdown([scan({ referrer_host: null })])[0]?.label).toBe(
      "สแกนจากป้ายโดยตรง",
    );
  });
});

describe("topQrCodes", () => {
  it("เรียงตามยอดสแกนและจำกัดจำนวน", () => {
    const titles = new Map([
      ["qr-1", "เมนู"],
      ["qr-2", "โปรโมชัน"],
    ]);
    const scans = [
      scan({ qr_code_id: "qr-1" }),
      scan({ qr_code_id: "qr-1" }),
      scan({ qr_code_id: "qr-2" }),
    ];
    const result = topQrCodes(scans, titles, 1);
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe("เมนู");
  });

  it("QR ที่หาชื่อไม่เจอยังนับได้ ไม่หายไปจากยอด", () => {
    const result = topQrCodes([scan({ qr_code_id: "ไม่รู้จัก" })], new Map());
    expect(result[0]).toEqual({ label: "ไม่มีชื่อ", count: 1, share: 1 });
  });
});

describe("splitBots", () => {
  it("แยกบอทออกจากยอดจริง เพื่อไม่ให้ตัวเลขสูงเกินความจริง", () => {
    const scans = [
      scan({ device_type: "mobile" }),
      scan({ device_type: "bot" }),
      scan({ device_type: "bot" }),
    ];
    const { human, bots } = splitBots(scans);
    expect(human).toHaveLength(1);
    expect(bots).toHaveLength(2);
  });

  it("ไม่มีการสแกนเลยก็ไม่พัง", () => {
    expect(splitBots([])).toEqual({ human: [], bots: [] });
  });
});

describe("แปลงรหัสจังหวัดในสถิติ", () => {
  it("แสดงชื่อจังหวัดไทย ไม่ใช่รหัสตัวเลขที่ Vercel ส่งมา", () => {
    const scans = [
      scan({ region: "10", country: "TH" }),
      scan({ region: "10", country: "TH" }),
      scan({ region: "50", country: "TH" }),
      scan({ region: "83", country: "TH" }),
    ];
    const labels = regionBreakdown(scans).map((item) => item.label);
    expect(labels).toEqual(["กรุงเทพมหานคร", "เชียงใหม่", "ภูเก็ต"]);
  });

  it("ผู้สแกนจากต่างประเทศยังนับได้ ไม่ถูกทิ้ง", () => {
    const result = regionBreakdown([scan({ region: "CA", country: "US" })]);
    expect(result[0]?.label).toBe("US · CA");
  });

  it("ไม่มีข้อมูลพื้นที่ก็จัดกลุ่มไว้ต่างหาก", () => {
    expect(regionBreakdown([scan({ region: null })])[0]?.label).toBe(
      "ไม่ระบุพื้นที่",
    );
  });
});
