/**
 * ตรวจลายเซ็นของ webhook จาก Opn Payments (Omise)
 *
 * สเปกที่อ้างอิง (https://docs.omise.co/api-webhooks):
 * - header `Omise-Signature` = HMAC-SHA256 เข้ารหัสฐานสิบหก
 *   ระหว่างช่วงเปลี่ยน secret จะมีสองค่าคั่นด้วยจุลภาค
 * - header `Omise-Signature-Timestamp` = เวลาที่เซ็น
 * - ข้อความที่ถูกเซ็นคือ `<TIMESTAMP>.<RAW_BODY>`
 *
 * ⚠️ ต้องตรวจกับ body ดิบเท่านั้น ห้าม JSON.parse แล้ว stringify ใหม่ก่อนตรวจ
 * เพราะลำดับคีย์และช่องว่างจะเปลี่ยน ลายเซ็นจะไม่ตรงทั้งที่ของจริง
 */

export const SIGNATURE_HEADER = "omise-signature";
export const TIMESTAMP_HEADER = "omise-signature-timestamp";

/** ยอมรับความต่างของเวลาได้เท่าไร — กัน replay ตามที่เอกสารแนะนำ */
export const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

export type VerifyInput = {
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  secret: string;
  now: Date;
};

export type VerifyResult =
  | { ok: true }
  | {
      ok: false;
      reason: "missing" | "signature" | "timestamp" | "not_configured";
    };

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function signPayload(
  secret: string,
  timestamp: string,
  rawBody: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );

  return toHex(signature);
}

/**
 * เทียบสตริงแบบใช้เวลาคงที่
 *
 * ถ้าเทียบด้วย === ปกติ เวลาที่ใช้จะสั้นลงเมื่อไม่ตรงตั้งแต่ตัวแรก
 * ซึ่งเปิดช่องให้เดาลายเซ็นทีละไบต์ได้
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export async function verifyWebhook(input: VerifyInput): Promise<VerifyResult> {
  if (input.secret === "") return { ok: false, reason: "not_configured" };
  if (input.signatureHeader === null || input.timestampHeader === null) {
    return { ok: false, reason: "missing" };
  }

  const sentAt = Number(input.timestampHeader);
  if (!Number.isFinite(sentAt)) return { ok: false, reason: "timestamp" };

  // timestamp ของ Omise เป็นวินาที — เทียบเป็นมิลลิวินาที
  const skew = Math.abs(input.now.getTime() - sentAt * 1000);
  if (skew > MAX_TIMESTAMP_SKEW_MS) return { ok: false, reason: "timestamp" };

  const expected = await signPayload(
    input.secret,
    input.timestampHeader,
    input.rawBody,
  );

  // ระหว่างเปลี่ยน secret จะมีสองลายเซ็น ต้องผ่านถ้าตรงอันใดอันหนึ่ง
  const candidates = input.signatureHeader
    .split(",")
    .map((part) => part.trim());
  const matched = candidates.some((candidate) =>
    timingSafeEqual(candidate.toLowerCase(), expected),
  );

  return matched ? { ok: true } : { ok: false, reason: "signature" };
}
