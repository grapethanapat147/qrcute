import { processOpnEvent } from "@/lib/billing/opn/process";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyWebhook,
} from "@/lib/billing/opn/signature";

/**
 * รับ webhook จาก Opn Payments
 *
 * หน้าที่ของไฟล์นี้มีสองอย่างเท่านั้น: ตรวจว่าคำขอมาจาก Opn จริง
 * แล้วแปลผลลัพธ์เป็นรหัส HTTP — ตรรกะธุรกิจอยู่ใน lib/billing/opn/process.ts
 * เพราะงานกระทบยอดต้องเรียกตรรกะชุดเดียวกันนี้ได้ด้วย
 *
 * ⚠️ Omise ไม่รับประกันการยิงซ้ำเมื่อส่งไม่สำเร็จ (https://docs.omise.co/api-webhooks)
 * เส้นทางนี้จึงไม่ใช่ทางเดียวที่สิทธิ์จะถูกเปิด ต้องรัน `bun run reconcile:opn` เป็นระยะ
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  // ต้องอ่าน body ดิบก่อนแตะอะไรทั้งนั้น — ลายเซ็นเซ็นบนไบต์ชุดนี้
  const rawBody = await request.text();

  const verified = await verifyWebhook({
    rawBody,
    signatureHeader: request.headers.get(SIGNATURE_HEADER),
    timestampHeader: request.headers.get(TIMESTAMP_HEADER),
    secret: process.env.OPN_WEBHOOK_SECRET ?? "",
    now: new Date(),
  });

  if (!verified.ok) {
    if (verified.reason === "not_configured") {
      console.error("[opn] ยังไม่ได้ตั้งค่า OPN_WEBHOOK_SECRET");
      return json(500, { ok: false });
    }
    return json(401, { ok: false, reason: verified.reason });
  }

  const result = await processOpnEvent(rawBody);

  switch (result.status) {
    case "unparsable":
      // ตอบ 4xx เพื่อให้ขึ้นเป็นสีแดงในแดชบอร์ดของ Opn ให้คนเห็น
      // ไม่มีการยิงซ้ำอยู่แล้ว การกลืนเงียบ ๆ จะทำให้ไม่มีใครรู้ว่าพลาด
      console.error("[opn] แกะเหตุการณ์ไม่ได้", rawBody.slice(0, 500));
      return json(400, { ok: false, reason: "unparsable" });

    case "wrong_livemode":
      return json(202, { ok: true, ignored: "livemode ไม่ตรงกับสภาพแวดล้อมนี้" });

    case "duplicate":
      return json(200, { ok: true, duplicate: true });

    case "processed":
      return json(200, { ok: true });
  }
}
