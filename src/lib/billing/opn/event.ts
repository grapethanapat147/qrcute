import type { GatewayEvent } from "../billing-events";
import { isPriceCode, type PriceCode } from "../plans";

/**
 * แกะเหตุการณ์ที่ Opn ส่งมาให้อยู่ในรูปที่ระบบสิทธิ์เข้าใจ
 *
 * รูปของ event object ที่ยืนยันจากเอกสาร (https://docs.omise.co/api-webhooks):
 * `object` `id` (`evnt_...`) `livemode` `location` `key` `created_at` `data`
 * โดย `data` คือ object ของสิ่งที่เกิดเหตุการณ์ ซึ่งกรณีเราคือ charge
 *
 * ⚠️ ทุกฟิลด์ถูกอ่านแบบระวังตัว ถ้าอะไรไม่ตรงรูปจะคืน null แทนการเดา
 * ตามกติกาใน CLAUDE.md — body ดิบถูกเก็บไว้ใน webhook_events อยู่แล้ว
 * เหตุการณ์ที่แกะไม่ออกจึงกู้คืนด้วยมือได้เสมอ ไม่ได้หายไปไหน
 */

export type OpnCharge = {
  chargeId: string;
  status: string;
  amountSatang: number;
  currency: string;
  paidAt: Date | null;
  ownerId: string | null;
  priceCode: PriceCode | null;
};

export type ParsedOpnEvent = {
  event: GatewayEvent;
  livemode: boolean;
  charge: OpnCharge | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function asDate(value: unknown): Date | null {
  const text = asString(value);
  if (text === null) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * owner_id มาจาก metadata ที่เราแนบไปเองตอนสร้าง charge
 *
 * ถึงจะเชื่อได้เพราะผ่านการตรวจลายเซ็นมาแล้ว ก็ยังต้องตรวจรูปแบบ
 * เพราะค่านี้จะถูกเอาไปใส่ใน query ที่แก้สิทธิ์ของบัญชี
 */
function asOwnerId(value: unknown): string | null {
  const text = asString(value);
  return text !== null && UUID_PATTERN.test(text) ? text : null;
}

function parseCharge(data: unknown): OpnCharge | null {
  const charge = asRecord(data);
  if (charge === null) return null;
  if (charge.object !== "charge") return null;

  const chargeId = asString(charge.id);
  const status = asString(charge.status);
  if (chargeId === null || status === null) return null;

  // จำนวนเงินของ Omise เป็นหน่วยย่อยที่สุดของสกุลเงินอยู่แล้ว — บาทคือสตางค์
  const amountSatang =
    typeof charge.amount === "number" && Number.isInteger(charge.amount)
      ? charge.amount
      : 0;

  const metadata = asRecord(charge.metadata) ?? {};
  const priceCode = asString(metadata.price_code);

  return {
    chargeId,
    status,
    amountSatang,
    currency: (asString(charge.currency) ?? "thb").toUpperCase(),
    paidAt: asDate(charge.paid_at),
    ownerId: asOwnerId(metadata.owner_id),
    priceCode: priceCode !== null && isPriceCode(priceCode) ? priceCode : null,
  };
}

export function parseOpnEvent(rawBody: string): ParsedOpnEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const envelope = asRecord(parsed);
  if (envelope === null) return null;

  const id = asString(envelope.id);
  const key = asString(envelope.key);
  const createdAt = asDate(envelope.created_at);
  if (id === null || key === null || createdAt === null) return null;

  const charge = parseCharge(envelope.data);

  return {
    event: {
      id,
      key,
      createdAt,
      chargeStatus: charge?.status,
      priceCode: charge?.priceCode ?? undefined,
    },
    livemode: envelope.livemode === true,
    charge,
  };
}
