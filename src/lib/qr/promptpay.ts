/**
 * PromptPay QR — EMVCo Merchant Presented Mode (Thai QR Payment)
 *
 * โครงสร้าง payload เป็น TLV (Tag-Length-Value) ตามสเปก EMVCo MPM
 * โดยข้อมูลฝั่งไทยอยู่ใน tag 29 ที่มี AID ของ ITMX
 *
 * ที่มาของสเปกที่ใช้เขียนไฟล์นี้:
 * - EMVCo Merchant Presented QR Specification v1.1 (โครง TLV, tag 00/01/53/54/58/63)
 * - thai-qr-payment.js.org/reference/spec (tag 29, AID, รูปแบบเบอร์/บัตร/e-Wallet)
 * - dtinth/promptpay-qr (ลำดับ tag และ golden vector ที่ใช้ใน test)
 *
 * ⚠️ ห้ามแก้ค่าคงที่ในไฟล์นี้โดยไม่มีเอกสารอ้างอิง และห้าม deploy
 * ถ้ายังไม่ได้ทดสอบสแกนด้วยแอปธนาคารจริง (ดู docs/prd.md §2.3)
 */

const TAG_PAYLOAD_FORMAT = "00";
const TAG_POINT_OF_INITIATION = "01";
const TAG_MERCHANT_INFO_BOT = "29";
const TAG_COUNTRY_CODE = "58";
const TAG_CURRENCY = "53";
const TAG_AMOUNT = "54";
const TAG_CRC = "63";

const BOT_SUBTAG_AID = "00";
const BOT_SUBTAG_MOBILE = "01";
/** บัตรประชาชนและ Tax ID ใช้ sub-tag เดียวกัน ต่างกันแค่ป้ายกำกับใน UI */
const BOT_SUBTAG_NATIONAL_ID = "02";
const BOT_SUBTAG_EWALLET = "03";

const PROMPTPAY_AID = "A000000677010111";
const PAYLOAD_FORMAT_VERSION = "01";
const POINT_OF_INITIATION_STATIC = "11";
const POINT_OF_INITIATION_DYNAMIC = "12";
const CURRENCY_THB = "764";
const COUNTRY_TH = "TH";

const MAX_AMOUNT = 9_999_999_999.99;

export const PROMPTPAY_TARGET_TYPES = [
  "mobile",
  "nationalId",
  "taxId",
  "ewallet",
] as const;

export type PromptPayTargetType = (typeof PROMPTPAY_TARGET_TYPES)[number];

export const PROMPTPAY_TARGET_LABELS: Record<PromptPayTargetType, string> = {
  mobile: "เบอร์โทรศัพท์",
  nationalId: "เลขบัตรประชาชน",
  taxId: "เลขประจำตัวผู้เสียภาษี",
  ewallet: "e-Wallet ID",
};

export type PromptPayInput = {
  targetType: PromptPayTargetType;
  target: string;
  /** จำนวนเงินเป็นข้อความจากฟอร์ม — ว่างได้ แปลว่าให้ผู้จ่ายกรอกเอง */
  amount: string;
};

// ---------------------------------------------------------------------------
// CRC
// ---------------------------------------------------------------------------

/**
 * CRC-16/CCITT-FALSE — poly 0x1021, init 0xFFFF, ไม่ reflect, ไม่ XOR out
 * ค่าตรวจสอบมาตรฐาน: CRC ของ "123456789" = 0x29B1 (มี test ยืนยัน)
 */
export function crc16ccitt(input: string): number {
  let crc = 0xffff;

  for (let index = 0; index < input.length; index += 1) {
    crc ^= (input.charCodeAt(index) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc =
        (crc & 0x8000) !== 0
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }

  return crc;
}

// ---------------------------------------------------------------------------
// TLV
// ---------------------------------------------------------------------------

/**
 * ประกอบ Tag-Length-Value หนึ่งชุด
 *
 * ความยาวนับเป็นจำนวนอักขระ ใช้ได้เพราะทุก value ในสเปกนี้เป็น ASCII
 * (ตัวเลข ตัวอักษรอังกฤษ และจุด) ถ้าอนาคตมี field ที่รับภาษาไทยต้องเปลี่ยนไปนับ byte
 */
function tlv(tag: string, value: string): string {
  if (value.length > 99) {
    throw new Error(`ค่าของ tag ${tag} ยาวเกิน 99 อักขระ`);
  }
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

// ---------------------------------------------------------------------------
// normalize
// ---------------------------------------------------------------------------

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * เบอร์โทรไทยในรูปแบบ PromptPay = 13 อักขระ
 * 0812345678 → 66812345678 → เติม 0 ข้างหน้าให้ครบ 13 → 0066812345678
 */
export function formatPromptPayMobile(value: string): string {
  return digitsOnly(value).replace(/^0/, "66").padStart(13, "0");
}

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

/** คืนข้อความ error ภาษาไทย หรือ null ถ้าผ่าน */
export function validatePromptPay(input: PromptPayInput): string | null {
  const digits = digitsOnly(input.target);

  if (digits === "") {
    return `กรุณากรอก${PROMPTPAY_TARGET_LABELS[input.targetType]}`;
  }

  switch (input.targetType) {
    case "mobile": {
      const localLength = digits.startsWith("66")
        ? digits.length - 1
        : digits.length;
      if (localLength !== 10) {
        return "เบอร์โทรต้องมี 10 หลัก เช่น 081-234-5678";
      }
      break;
    }
    case "nationalId":
      if (digits.length !== 13) {
        return "เลขบัตรประชาชนต้องมี 13 หลัก";
      }
      break;
    case "taxId":
      if (digits.length !== 13) {
        return "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก";
      }
      break;
    case "ewallet":
      if (digits.length !== 15) {
        return "e-Wallet ID ต้องมี 15 หลัก";
      }
      break;
  }

  const trimmedAmount = input.amount.trim();
  if (trimmedAmount !== "") {
    const amount = Number(trimmedAmount);
    if (!Number.isFinite(amount)) {
      return "จำนวนเงินต้องเป็นตัวเลข";
    }
    if (amount <= 0) {
      return "จำนวนเงินต้องมากกว่า 0 บาท";
    }
    if (amount > MAX_AMOUNT) {
      return "จำนวนเงินเกินกว่าที่มาตรฐานรองรับ";
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

function buildMerchantInfo(input: PromptPayInput): string {
  const digits = digitsOnly(input.target);

  const target =
    input.targetType === "mobile"
      ? tlv(BOT_SUBTAG_MOBILE, formatPromptPayMobile(input.target))
      : input.targetType === "ewallet"
        ? tlv(BOT_SUBTAG_EWALLET, digits)
        : tlv(BOT_SUBTAG_NATIONAL_ID, digits);

  return tlv(BOT_SUBTAG_AID, PROMPTPAY_AID) + target;
}

export class PromptPayError extends Error {
  override name = "PromptPayError";
}

/**
 * สร้าง payload PromptPay ที่พร้อมเข้ารหัสเป็น QR
 *
 * ลำดับ tag เรียงตาม reference implementation ที่ใช้งานจริงกับแอปธนาคารไทย
 * (00 → 01 → 29 → 58 → 53 → 54 → 63) ไม่ได้เรียงตามเลข tag
 * EMVCo ไม่บังคับลำดับ แต่เราตามของที่พิสูจน์แล้วว่าใช้ได้
 */
export function buildPromptPayPayload(input: PromptPayInput): string {
  const validationError = validatePromptPay(input);
  if (validationError !== null) {
    throw new PromptPayError(validationError);
  }

  const trimmedAmount = input.amount.trim();
  const hasAmount = trimmedAmount !== "";

  const body =
    tlv(TAG_PAYLOAD_FORMAT, PAYLOAD_FORMAT_VERSION) +
    tlv(
      TAG_POINT_OF_INITIATION,
      hasAmount ? POINT_OF_INITIATION_DYNAMIC : POINT_OF_INITIATION_STATIC,
    ) +
    tlv(TAG_MERCHANT_INFO_BOT, buildMerchantInfo(input)) +
    tlv(TAG_COUNTRY_CODE, COUNTRY_TH) +
    tlv(TAG_CURRENCY, CURRENCY_THB) +
    (hasAmount ? tlv(TAG_AMOUNT, Number(trimmedAmount).toFixed(2)) : "");

  // CRC คำนวณครอบ "6304" ที่ต่อท้ายไว้ด้วย ตามสเปก EMVCo
  const withCrcHeader = `${body}${TAG_CRC}04`;
  const checksum = crc16ccitt(withCrcHeader)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");

  return `${withCrcHeader}${checksum}`;
}

/** ตรวจว่า payload ที่ได้มามี CRC ถูกต้องหรือไม่ */
export function verifyPromptPayChecksum(payload: string): boolean {
  if (payload.length < 8) return false;
  const body = payload.slice(0, -4);
  const provided = payload.slice(-4).toUpperCase();
  if (!body.endsWith(`${TAG_CRC}04`)) return false;

  const expected = crc16ccitt(body).toString(16).toUpperCase().padStart(4, "0");
  return provided === expected;
}
