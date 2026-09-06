/**
 * ดึงข้อมูลที่จำเป็นออกจากคำขอ HTTP ตอนมีคนสแกน
 *
 * เก็บเท่าที่ตอบคำถามที่ลูกค้าจ่ายเงินเพื่อจะรู้ ไม่เก็บเพราะเผื่อได้ใช้
 * รายการที่ตั้งใจไม่เก็บและเหตุผล อยู่ใน docs/decisions/0006-scan-analytics-privacy.md
 */

export const DEVICE_TYPES = [
  "mobile",
  "tablet",
  "desktop",
  "bot",
  "unknown",
] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

const BOT_PATTERN =
  /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|curl|wget|headless/i;
const TABLET_PATTERN = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i;
const MOBILE_PATTERN =
  /mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i;

/**
 * แยกประเภทอุปกรณ์แบบหยาบ ๆ จาก User-Agent
 *
 * เก็บแค่ประเภท ไม่เก็บ User-Agent เต็ม เพราะสตริงเต็มใช้ทำ fingerprint ได้
 * ความแม่นยำระดับนี้พอสำหรับคำถาม "ลูกค้าสแกนจากมือถือหรือคอม"
 */
export function deviceTypeFromUserAgent(userAgent: string | null): DeviceType {
  if (userAgent === null || userAgent.trim() === "") return "unknown";
  if (BOT_PATTERN.test(userAgent)) return "bot";
  if (TABLET_PATTERN.test(userAgent)) return "tablet";
  if (MOBILE_PATTERN.test(userAgent)) return "mobile";
  return "desktop";
}

/** เก็บแค่ชื่อโฮสต์ของ referrer พอจะรู้ว่าลิงก์ถูกเอาไปแปะที่ไหน */
export function referrerHost(referrer: string | null): string | null {
  if (referrer === null || referrer === "") return null;
  try {
    return new URL(referrer).hostname;
  } catch {
    return null;
  }
}

export type ScanContext = {
  country: string | null;
  region: string | null;
  deviceType: DeviceType;
  referrerHost: string | null;
};

export function readScanContext(headers: Headers): ScanContext {
  const emptyToNull = (value: string | null) =>
    value === null || value.trim() === "" ? null : value;

  return {
    // Vercel ใส่ข้อมูลตำแหน่งระดับประเทศ/ภูมิภาคมาให้ใน header ไม่ต้องเรียกบริการอื่น
    country: emptyToNull(headers.get("x-vercel-ip-country")),
    region: emptyToNull(headers.get("x-vercel-ip-country-region")),
    deviceType: deviceTypeFromUserAgent(headers.get("user-agent")),
    referrerHost: referrerHost(headers.get("referer")),
  };
}

/** วันที่แบบ UTC ใช้เป็นส่วนหนึ่งของ hash เพื่อให้ hash เปลี่ยนทุกวัน */
export function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * hash ของ IP สำหรับนับผู้สแกนไม่ซ้ำต่อวันและจับ bot ที่ยิงรัว
 *
 * ผูกกับ shortcode และวันที่ ทำให้ hash เดียวกันข้าม QR หรือข้ามวันไม่ตรงกัน
 * จึงตามรอยคนข้าม QR หลายอันหรือข้ามวันไม่ได้
 *
 * ⚠️ IPv4 มีแค่ ~4 พันล้านค่า ถ้า salt รั่วพร้อมฐานข้อมูลก็ไล่ hash กลับได้
 * นี่คือการ "ลดความเสี่ยง" ไม่ใช่การทำให้เป็นข้อมูลนิรนามตามกฎหมาย
 */
export async function hashIp(
  ip: string | null,
  shortcode: string,
  salt: string,
  now: Date,
): Promise<string | null> {
  if (ip === null || ip === "" || salt === "") return null;

  const input = `${salt}|${ip}|${shortcode}|${utcDateKey(now)}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** IP ที่ proxy ส่งมา — ตัวแรกใน x-forwarded-for คือผู้เรียกจริง */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded === null || forwarded.trim() === "") {
    return headers.get("x-real-ip");
  }
  return forwarded.split(",")[0]?.trim() ?? null;
}
