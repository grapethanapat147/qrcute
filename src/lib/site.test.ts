import { describe, expect, it } from "vitest";
import { absoluteUrl, siteConfig } from "@/lib/site";

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
