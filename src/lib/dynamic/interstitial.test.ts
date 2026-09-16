import { describe, expect, it } from "vitest";
import {
  destinationLabel,
  renderInterstitial,
  safeHttpUrl,
} from "./interstitial";

const SITE = { siteName: "QR Cute", siteUrl: "https://example.test" };

describe("safeHttpUrl", () => {
  it("ยอมรับ http และ https", () => {
    expect(safeHttpUrl("https://ร้านลุงสมชาย.com/menu")).not.toBeNull();
    expect(safeHttpUrl("http://menu.example/a")).not.toBeNull();
  });

  it("ปฏิเสธ scheme ที่รันโค้ดได้", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHttpUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("ปฏิเสธข้อความที่ไม่ใช่ URL", () => {
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("menu.example/a")).toBeNull();
  });
});

describe("หน้าคั่นของ QR ที่ถูกพัก", () => {
  const page = renderInterstitial({
    kind: "suspended",
    target: "https://menu.example/somchai",
    ...SITE,
  });

  it("ต้องมีปุ่มไปปลายทางเดิม (ADR 0008 กฎข้อ 1)", () => {
    expect(page).toContain('href="https://menu.example/somchai"');
    expect(page).toContain("ไปยังปลายทาง");
  });

  it("ต้องบอกว่ากำลังจะไปที่ไหน (กฎข้อ 3)", () => {
    expect(page).toContain("menu.example");
  });

  it("ต้องไม่โทษเจ้าของร้านหรือพูดเรื่องเงิน (กฎข้อ 2)", () => {
    for (const word of ["จ่าย", "ค้างชำระ", "หมดอายุ", "เจ้าของ", "แพ็กเกจ"]) {
      expect(page).not.toContain(word);
    }
  });

  it("ต้องไม่ให้ search engine เก็บหน้านี้", () => {
    expect(page).toContain('content="noindex, nofollow"');
  });

  it("ตัดบรรทัดไทยถูก", () => {
    expect(page).toContain('<html lang="th">');
  });
});

describe("หน้าคั่นของ QR ที่หยุดทำงานแล้ว", () => {
  const page = renderInterstitial({
    kind: "disabled",
    target: "https://menu.example/somchai",
    ...SITE,
  });

  it("ต้องไม่มีปุ่มพาไปปลายทาง", () => {
    expect(page).not.toContain("https://menu.example/somchai");
    expect(page).not.toContain("ไปยังปลายทาง");
  });

  it("บอกทางออกให้คนสแกนโดยไม่โทษใคร", () => {
    expect(page).toContain("ไม่ได้ใช้งานแล้ว");
    expect(page).toContain("สอบถามจากร้าน");
  });
});

describe("ความปลอดภัยของค่าที่มาจากฐานข้อมูล", () => {
  it("ปลายทางที่เป็น javascript: ต้องไม่ถูกทำเป็นปุ่ม", () => {
    const page = renderInterstitial({
      kind: "suspended",
      target: "javascript:alert(document.cookie)",
      ...SITE,
    });

    expect(page).not.toContain("javascript:");
    expect(page).toContain("ไม่ได้ใช้งานแล้ว");
  });

  it("ปลายทางที่พยายามแหก attribute ต้องถูก escape", () => {
    const page = renderInterstitial({
      kind: "suspended",
      target: 'https://evil.example/"><script>alert(1)</script>',
      ...SITE,
    });

    // URL.toString() เข้ารหัสอักขระอันตรายให้ก่อนแล้ว ก่อนจะถึงชั้น escapeHtml
    expect(page).not.toContain("<script>alert(1)</script>");
    expect(page).not.toContain('evil.example/">');
    expect(page).toContain("%3Cscript%3E");
  });

  it("ปลายทางที่หายไปต้องไม่ทำให้หน้าพัง", () => {
    const page = renderInterstitial({
      kind: "suspended",
      target: null,
      ...SITE,
    });
    expect(page).toContain("ไม่ได้ใช้งานแล้ว");
  });
});

describe("destinationLabel", () => {
  it("คืนเฉพาะชื่อโฮสต์ ไม่เอา path มาด้วย", () => {
    expect(destinationLabel("https://menu.example/a/b?c=1")).toBe(
      "menu.example",
    );
  });

  it("URL พังคืนค่าว่าง ไม่โยน error", () => {
    expect(destinationLabel("ไม่ใช่ url")).toBe("");
  });
});
