import { afterEach, describe, expect, it } from "vitest";
import { absoluteUrl, assertUrlConfigured, siteConfig } from "@/lib/site";

describe("siteConfig", () => {
  it("มีภาษาไทยเป็นภาษาเริ่มต้น", () => {
    expect(siteConfig.defaultLanguage).toBe("th");
    expect(siteConfig.supportedLanguages).toContain("th");
  });

  it("absoluteUrl ต่อ path เข้ากับโดเมนหลักได้", () => {
    expect(absoluteUrl("/qr/promptpay")).toBe(
      new URL("/qr/promptpay", siteConfig.url).toString(),
    );
  });

  it("absoluteUrl คืน root เมื่อไม่ส่ง path", () => {
    expect(absoluteUrl()).toBe(new URL("/", siteConfig.url).toString());
  });
});

describe("assertUrlConfigured", () => {
  const original = process.env.VERCEL_ENV;
  afterEach(() => {
    if (original === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = original;
  });

  it("ไม่บ่นเมื่ออยู่นอก production", () => {
    delete process.env.VERCEL_ENV;
    expect(() => assertUrlConfigured()).not.toThrow();

    process.env.VERCEL_ENV = "preview";
    expect(() => assertUrlConfigured()).not.toThrow();
  });

  /**
   * ค่า url ถูก freeze ตอน import แล้ว test นี้จึงตรวจตรรกะผ่านสภาพจริงของ config
   * ถ้าวันไหนตั้งโดเมนจริงแล้ว เงื่อนไขจะกลับด้านเอง ซึ่งเป็นสิ่งที่ต้องการ
   */
  it("โยน error ถ้าโดเมนยังเป็น localhost บน production", () => {
    process.env.VERCEL_ENV = "production";

    if (siteConfig.url.includes("localhost")) {
      expect(() => assertUrlConfigured()).toThrow(/localhost/);
    } else {
      expect(() => assertUrlConfigured()).not.toThrow();
    }
  });
});
