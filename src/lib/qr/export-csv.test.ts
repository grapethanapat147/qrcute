import { describe, expect, it } from "vitest";
import { qrExportCsv, toCsv } from "./export-csv";

describe("toCsv", () => {
  it("มี BOM ให้ Excel อ่านภาษาไทยได้", () => {
    expect(toCsv([["ร้าน"]]).startsWith("﻿")).toBe(true);
  });

  it("ครอบเครื่องหมายคำพูด จุลภาค และขึ้นบรรทัดใหม่ถูกต้อง", () => {
    expect(toCsv([['ร้าน "ลุง", สาขา 1']])).toBe('﻿"ร้าน ""ลุง"", สาขา 1"\r\n');
  });

  it("กันสูตร Excel ที่แฝงมาในชื่อ QR", () => {
    const out = toCsv([
      ['=HYPERLINK("http://evil")'],
      ["+66812345678"],
      ["@SUM(A1)"],
    ]);
    expect(out).not.toMatch(/(^|\n)"?[=+@]/);
  });
});

describe("qrExportCsv", () => {
  const base = {
    status: "active",
    created_at: "2026-11-06T10:00:00Z",
    shortcode: null,
    current_target: null,
  };

  it("QR แบบฝังตรงส่งออกข้อมูลจริงที่อยู่ในภาพ เอาไปสร้างใหม่ที่ไหนก็ได้", () => {
    const csv = qrExportCsv(
      [
        {
          ...base,
          title: "WiFi ร้าน",
          kind: "static",
          qr_type: "wifi",
          content: {
            type: "wifi",
            ssid: "shop",
            password: "1234",
            encryption: "WPA",
            hidden: false,
          },
        },
      ],
      "https://qrcute.com",
    );
    expect(csv).toContain("ฝังข้อมูลตรง");
    expect(csv).toContain("WIFI:");
  });

  it("QR แบบแก้ได้ส่งออกทั้งลิงก์ในภาพและปลายทางปัจจุบัน", () => {
    const csv = qrExportCsv(
      [
        {
          ...base,
          title: "เมนู",
          kind: "dynamic",
          qr_type: "url",
          content: {},
          shortcode: "abc2345",
          current_target: "https://menu.example/a",
        },
      ],
      "https://qrcute.com",
    );
    expect(csv).toContain("https://qrcute.com/r/abc2345");
    expect(csv).toContain("https://menu.example/a");
    expect(csv).toContain("แก้ปลายทางได้");
  });

  it("content ที่พังไม่ทำให้ส่งออกทั้งไฟล์ล้ม", () => {
    const csv = qrExportCsv(
      [{ ...base, title: "พัง", kind: "static", qr_type: "url", content: null }],
      "https://qrcute.com",
    );
    expect(csv).toContain("พัง");
  });
});
