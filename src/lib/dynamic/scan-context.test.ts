import { describe, expect, it } from "vitest";
import {
  clientIp,
  deviceTypeFromUserAgent,
  hashIp,
  readScanContext,
  referrerHost,
  utcDateKey,
} from "./scan-context";

const SALT = "เกลือทดสอบ";

describe("deviceTypeFromUserAgent", () => {
  it("แยก bot ออกก่อนเสมอ เพื่อไม่ให้ปนกับยอดสแกนจริง", () => {
    expect(deviceTypeFromUserAgent("Googlebot/2.1")).toBe("bot");
    expect(deviceTypeFromUserAgent("facebookexternalhit/1.1")).toBe("bot");
    expect(deviceTypeFromUserAgent("curl/8.4.0")).toBe("bot");
  });

  it("แยกมือถือกับแท็บเล็ตออกจากกัน", () => {
    expect(
      deviceTypeFromUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148",
      ),
    ).toBe("mobile");
    expect(
      deviceTypeFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"),
    ).toBe("tablet");
    expect(
      deviceTypeFromUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S918B)"),
    ).toBe("tablet");
    expect(
      deviceTypeFromUserAgent(
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) Mobile Safari/537.36",
      ),
    ).toBe("mobile");
  });

  it("ที่เหลือถือเป็นเดสก์ท็อป และค่าว่างถือว่าไม่รู้", () => {
    expect(
      deviceTypeFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"),
    ).toBe("desktop");
    expect(deviceTypeFromUserAgent(null)).toBe("unknown");
    expect(deviceTypeFromUserAgent("  ")).toBe("unknown");
  });
});

describe("referrerHost", () => {
  it("เก็บแค่ชื่อโฮสต์ ไม่เก็บ path หรือ query", () => {
    expect(referrerHost("https://line.me/some/path?utm=abc")).toBe("line.me");
  });

  it("ค่าที่ไม่ใช่ URL ถือว่าไม่มี", () => {
    expect(referrerHost("ไม่ใช่ลิงก์")).toBeNull();
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost("")).toBeNull();
  });
});

describe("readScanContext", () => {
  it("อ่านประเทศและภูมิภาคจาก header ของ Vercel", () => {
    const headers = new Headers({
      "x-vercel-ip-country": "TH",
      "x-vercel-ip-country-region": "10",
      "user-agent": "Mozilla/5.0 (iPhone) Mobile/15E148",
      referer: "https://line.me/",
    });

    expect(readScanContext(headers)).toEqual({
      country: "TH",
      region: "10",
      deviceType: "mobile",
      referrerHost: "line.me",
    });
  });

  it("ไม่มี header อะไรเลยก็ยังทำงานได้ ไม่โยน error", () => {
    expect(readScanContext(new Headers())).toEqual({
      country: null,
      region: null,
      deviceType: "unknown",
      referrerHost: null,
    });
  });
});

describe("clientIp", () => {
  it("เอาตัวแรกของ x-forwarded-for ซึ่งเป็นผู้เรียกจริง", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178",
    });
    expect(clientIp(headers)).toBe("203.0.113.9");
  });

  it("ถอยไปใช้ x-real-ip เมื่อไม่มี x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("hashIp", () => {
  const day = new Date("2026-09-06T08:00:00Z");

  it("IP เดียวกัน วันเดียวกัน QR เดียวกัน ได้ค่าเดิม — ใช้นับคนไม่ซ้ำได้", async () => {
    const a = await hashIp("203.0.113.9", "a2c4e6g", SALT, day);
    const b = await hashIp(
      "203.0.113.9",
      "a2c4e6g",
      SALT,
      new Date("2026-09-06T23:59:00Z"),
    );
    expect(a).toBe(b);
  });

  it("ข้าม QR คนละอันแล้วค่าไม่ตรงกัน — ตามรอยข้าม QR ไม่ได้", async () => {
    const a = await hashIp("203.0.113.9", "a2c4e6g", SALT, day);
    const b = await hashIp("203.0.113.9", "b3d5f7h", SALT, day);
    expect(a).not.toBe(b);
  });

  it("ข้ามวันแล้วค่าไม่ตรงกัน — ตามรอยข้ามวันไม่ได้", async () => {
    const a = await hashIp("203.0.113.9", "a2c4e6g", SALT, day);
    const b = await hashIp(
      "203.0.113.9",
      "a2c4e6g",
      SALT,
      new Date("2026-09-07T08:00:00Z"),
    );
    expect(a).not.toBe(b);
  });

  it("เกลือคนละค่าให้ผลคนละอย่าง", async () => {
    const a = await hashIp("203.0.113.9", "a2c4e6g", SALT, day);
    const b = await hashIp("203.0.113.9", "a2c4e6g", "เกลืออื่น", day);
    expect(a).not.toBe(b);
  });

  it("ไม่มี IP หรือไม่ได้ตั้งเกลือ ต้องไม่บันทึกอะไรเลย", async () => {
    expect(await hashIp(null, "a2c4e6g", SALT, day)).toBeNull();
    expect(await hashIp("203.0.113.9", "a2c4e6g", "", day)).toBeNull();
  });

  it("ผลลัพธ์เป็น hex ของ SHA-256 ยาว 64 ตัว", async () => {
    const hash = await hashIp("203.0.113.9", "a2c4e6g", SALT, day);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ไม่มี IP ดิบหลงเหลืออยู่ในผลลัพธ์", async () => {
    const hash = await hashIp("203.0.113.9", "a2c4e6g", SALT, day);
    expect(hash).not.toContain("203");
  });
});

describe("utcDateKey", () => {
  it("ใช้เวลา UTC เสมอ เพื่อให้ทุก edge region ตัดวันตรงกัน", () => {
    // 06:00 ตามเวลาไทยของวันที่ 7 = 23:00 UTC ของวันที่ 6
    expect(utcDateKey(new Date("2026-09-06T23:00:00Z"))).toBe("2026-09-06");
  });
});
