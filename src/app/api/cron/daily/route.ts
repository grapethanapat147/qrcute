import { deleteExpiredScans, runDowngradeSweep } from "@/lib/billing/store";

/**
 * งานรายวัน
 *
 * เรียกโดย Vercel Cron ตามตารางใน vercel.json (03:00 เวลาไทย = 20:00 UTC)
 * เลือกเวลานี้เพราะเป็นช่วงที่คนสแกน QR น้อยที่สุด งานที่ไปแตะตาราง qr_codes
 * จึงกวนเส้นทาง /r/[code] น้อยที่สุดด้วย
 *
 * ทำสองอย่าง:
 * 1. เดินลำดับเวลาการลดระดับ (docs/decisions/0008-downgrade-behaviour.md)
 * 2. ลบ scan ดิบที่เลยกำหนดเก็บ (docs/decisions/0006-scan-analytics-privacy.md)
 *
 * ทั้งสองงานเรียกซ้ำได้โดยผลไม่เปลี่ยน ถ้า cron พลาดไปวันหนึ่ง
 * วันถัดไปจะตามเก็บให้เองโดยไม่ต้องทำอะไรเพิ่ม
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * เทียบสตริงแบบใช้เวลาคงที่
 *
 * เขียนซ้ำที่นี่แทนที่จะไปใช้ของใน lib/billing/opn เพราะงานรายวัน
 * ไม่ควรผูกกับผู้ให้บริการชำระเงินเจ้าใดเจ้าหนึ่ง
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret === "") return false;

  return timingSafeEqual(
    request.headers.get("authorization") ?? "",
    `Bearer ${secret}`,
  );
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    // งานนี้เปลี่ยนสถานะ QR ของลูกค้าจริง ใครก็ตามที่ยิงได้เอง
    // จะสั่งพัก QR ของคนอื่นไม่ได้ก็จริง แต่ปั่นภาระฐานข้อมูลได้
    return new Response("unauthorized", { status: 401 });
  }

  const downgrade = await runDowngradeSweep();
  const removedScans = await deleteExpiredScans();

  const summary = { ...downgrade, removedScans };
  console.log("[cron] งานรายวันเสร็จ", summary);

  return new Response(JSON.stringify({ ok: true, ...summary }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
