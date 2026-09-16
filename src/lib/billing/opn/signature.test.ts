import { describe, expect, it } from "vitest";
import { MAX_TIMESTAMP_SKEW_MS, signPayload, verifyWebhook } from "./signature";

const SECRET = "whsec_ทดสอบ_1234567890";
const BODY = '{"object":"event","id":"evnt_test_1","key":"charge.complete"}';
const NOW = new Date("2026-09-07T12:00:00Z");
const TIMESTAMP = String(Math.floor(NOW.getTime() / 1000));

async function validSignature(body = BODY, timestamp = TIMESTAMP) {
  return signPayload(SECRET, timestamp, body);
}

describe("verifyWebhook", () => {
  it("ผ่านเมื่อลายเซ็นถูกต้อง", async () => {
    const result = await verifyWebhook({
      rawBody: BODY,
      signatureHeader: await validSignature(),
      timestampHeader: TIMESTAMP,
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("ปฏิเสธเมื่อ body ถูกแก้แม้แต่ตัวอักษรเดียว", async () => {
    const signature = await validSignature();
    const result = await verifyWebhook({
      rawBody: `${BODY} `,
      signatureHeader: signature,
      timestampHeader: TIMESTAMP,
      secret: SECRET,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "signature" });
  });

  it("ปฏิเสธเมื่อ secret ไม่ตรง", async () => {
    const result = await verifyWebhook({
      rawBody: BODY,
      signatureHeader: await signPayload("secret อื่น", TIMESTAMP, BODY),
      timestampHeader: TIMESTAMP,
      secret: SECRET,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "signature" });
  });

  it("รับได้เมื่อมีสองลายเซ็นคั่นจุลภาค (ช่วงเปลี่ยน secret)", async () => {
    const good = await validSignature();
    const result = await verifyWebhook({
      rawBody: BODY,
      signatureHeader: `deadbeef, ${good}`,
      timestampHeader: TIMESTAMP,
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("ปฏิเสธเมื่อ timestamp เก่าเกินหน้าต่างที่ยอมรับ — กัน replay", async () => {
    const old = String(
      Math.floor((NOW.getTime() - MAX_TIMESTAMP_SKEW_MS - 1000) / 1000),
    );
    const result = await verifyWebhook({
      rawBody: BODY,
      signatureHeader: await validSignature(BODY, old),
      timestampHeader: old,
      secret: SECRET,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "timestamp" });
  });

  it("ปฏิเสธ timestamp จากอนาคตไกลด้วย", async () => {
    const future = String(
      Math.floor((NOW.getTime() + MAX_TIMESTAMP_SKEW_MS + 1000) / 1000),
    );
    const result = await verifyWebhook({
      rawBody: BODY,
      signatureHeader: await validSignature(BODY, future),
      timestampHeader: future,
      secret: SECRET,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "timestamp" });
  });

  it("ปฏิเสธเมื่อไม่มี header", async () => {
    expect(
      await verifyWebhook({
        rawBody: BODY,
        signatureHeader: null,
        timestampHeader: TIMESTAMP,
        secret: SECRET,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "missing" });
  });

  it("ปฏิเสธเมื่อยังไม่ได้ตั้ง secret — ไม่ใช่ปล่อยผ่าน", async () => {
    // ถ้าลืมตั้ง env แล้วปล่อยผ่าน จะกลายเป็นช่องให้ใครก็ได้ยิงอัปเกรดสิทธิ์ตัวเอง
    expect(
      await verifyWebhook({
        rawBody: BODY,
        signatureHeader: await validSignature(),
        timestampHeader: TIMESTAMP,
        secret: "",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "not_configured" });
  });

  it("ไม่สนตัวพิมพ์เล็กใหญ่ของลายเซ็นฐานสิบหก", async () => {
    const signature = (await validSignature()).toUpperCase();
    const result = await verifyWebhook({
      rawBody: BODY,
      signatureHeader: signature,
      timestampHeader: TIMESTAMP,
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("ลายเซ็นของ body เดิมกับ timestamp ต่างกัน ต้องไม่เหมือนกัน", async () => {
    const a = await signPayload(SECRET, "1000", BODY);
    const b = await signPayload(SECRET, "2000", BODY);
    expect(a).not.toBe(b);
  });
});
