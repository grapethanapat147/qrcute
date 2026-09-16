import {
  applyIntent,
  FREE_STATE,
  toIntent,
} from "@/lib/billing/billing-events";
import {
  claimEvent,
  finishEvent,
  loadSubscription,
  recordPayment,
  restoreSuspendedQrCodes,
  saveSubscription,
} from "@/lib/billing/store";
import { parseOpnEvent } from "./event";

/**
 * ประมวลผลเหตุการณ์หนึ่งอันจาก Opn
 *
 * แยกออกจาก route handler เพราะมีผู้เรียกสองทาง และทั้งสองทางต้องได้ผลเหมือนกันเป๊ะ:
 * 1. webhook ที่ Opn ยิงมา (src/app/api/webhooks/opn/route.ts)
 * 2. งานกระทบยอดที่ไล่เก็บเหตุการณ์ที่ยิงไม่ถึง (scripts/reconcile-opn.ts)
 *    ซึ่งจำเป็นเพราะ Omise ไม่รับประกันการยิงซ้ำ
 *
 * ถ้าสองทางนี้ทำงานคนละแบบ การกระทบยอดจะกลายเป็นแหล่งของบั๊กแทนที่จะเป็นตาข่ายรับ
 */

export type ProcessResult =
  | { status: "unparsable" }
  | { status: "wrong_livemode" }
  | { status: "duplicate" }
  | { status: "processed"; outcome: string };

/**
 * เหตุการณ์โหมดทดสอบต้องไม่แตะสิทธิ์ของ production
 *
 * ถ้าเผลอตั้ง endpoint เดียวกันไว้ทั้งสองโหมด การกดทดสอบในแดชบอร์ด
 * จะกลายเป็นการแจกแพ็กเกจจริงฟรี
 */
export function expectedLivemode(): boolean {
  const configured = process.env.OPN_LIVEMODE;
  if (configured === "true") return true;
  if (configured === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function processOpnEvent(rawBody: string): Promise<ProcessResult> {
  const parsed = parseOpnEvent(rawBody);
  if (parsed === null) return { status: "unparsable" };
  if (parsed.livemode !== expectedLivemode()) {
    return { status: "wrong_livemode" };
  }

  const { event, charge } = parsed;

  // จองสิทธิ์ก่อนเสมอ — ทุกอย่างหลังบรรทัดนี้เกิดได้ครั้งเดียวต่อหนึ่งเหตุการณ์
  // (docs/prd.md §5.1 ข้อ 1: ยิงซ้ำกี่ครั้ง สิทธิ์ต้องไม่เปลี่ยนเกินหนึ่งครั้ง)
  const claim = await claimEvent({
    eventId: event.id,
    eventKey: event.key,
    rawBody,
  });
  if (claim === "duplicate") return { status: "duplicate" };

  const outcome: string[] = [];

  if (charge !== null) {
    await recordPayment(charge);
    outcome.push(`payment:${charge.status}`);
  }

  const intent = toIntent(event);

  if (intent.type === "ignore") {
    outcome.push(`ignore:${intent.reason}`);
  } else if (charge === null || charge.ownerId === null) {
    // เงินเข้าจริงแต่ไม่รู้ว่าของใคร — ต้องไม่เดา ปล่อยให้คนไปดูในตาราง payments
    outcome.push("ignore:ไม่พบ owner_id ใน metadata");
  } else {
    const current = (await loadSubscription(charge.ownerId)) ?? FREE_STATE;
    const next = applyIntent(current, intent);
    const written = await saveSubscription(
      charge.ownerId,
      next,
      event.createdAt,
    );

    outcome.push(
      written ? `${intent.type}:${next.plan}` : "stale:มีเหตุการณ์ที่ใหม่กว่าแล้ว",
    );

    // ADR 0008 สัญญาว่า "กลับมาจ่ายเมื่อไรก็ใช้ต่อได้ทันที"
    // ป้ายหน้าร้านต้องกลับมาทำงานในวินาทีที่เงินเข้า ไม่ใช่รอ cron รอบถัดไป
    if (written && intent.type === "activate" && next.plan !== "free") {
      const restored = await restoreSuspendedQrCodes(charge.ownerId);
      if (restored > 0) outcome.push(`restored:${restored}`);
    }
  }

  const joined = outcome.join(" ");
  await finishEvent(event.id, joined);

  return { status: "processed", outcome: joined };
}
