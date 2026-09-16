/**
 * งานกระทบยอดเหตุการณ์กับ Opn Payments
 *
 * 🔴 ทำไมงานนี้ถึงจำเป็น ไม่ใช่ของแถม
 *
 * > "Omise does not currently guarantee automatic retries for failed deliveries"
 * > — https://docs.omise.co/api-webhooks
 *
 * ถ้าเซิร์ฟเวอร์เราล่มหรือ deploy อยู่ตอนที่เขายิง webhook มา เหตุการณ์นั้นหายไปเลย
 * ผลคือ **ลูกค้าจ่ายเงินแล้วแต่สิทธิ์ไม่เปิด และไม่มีใครในระบบรู้ว่าเกิดขึ้น**
 * สคริปต์นี้คือทางเดียวที่จะจับกรณีแบบนั้นได้
 *
 * วิธีใช้
 *   bun run reconcile:opn              # ดูอย่างเดียว 7 วันล่าสุด
 *   bun run reconcile:opn --days=30    # ย้อนไป 30 วัน
 *   bun run reconcile:opn --apply      # ประมวลผลเหตุการณ์ที่หายไปจริง ๆ
 *
 * ควรตั้งให้รันอัตโนมัติอย่างน้อยวันละครั้งหลังเปิดขายจริง
 */

import { processOpnEvent } from "../src/lib/billing/opn/process";
import { findKnownEventIds } from "../src/lib/billing/store";

const API_BASE = "https://api.omise.co";
const PAGE_SIZE = 100;

type Options = { days: number; apply: boolean };

function parseArgs(argv: string[]): Options {
  const days = argv.find((arg) => arg.startsWith("--days="));

  return {
    days: days === undefined ? 7 : Math.max(1, Number(days.slice(7))),
    apply: argv.includes("--apply"),
  };
}

function requireSecretKey(): string {
  const key = process.env.OPN_SECRET_KEY;
  if (key === undefined || key === "") {
    throw new Error("ยังไม่ได้ตั้งค่า OPN_SECRET_KEY");
  }
  return key;
}

/**
 * ดึงเหตุการณ์ในช่วงเวลาที่กำหนด
 *
 * Omise ใช้ HTTP Basic auth โดยเอา secret key เป็นชื่อผู้ใช้และเว้นรหัสผ่านว่าง
 */
async function fetchEvents(
  secretKey: string,
  from: Date,
): Promise<Array<Record<string, unknown>>> {
  const authorization = `Basic ${btoa(`${secretKey}:`)}`;
  const events: Array<Record<string, unknown>> = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL(`${API_BASE}/events`);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("from", from.toISOString());

    const response = await fetch(url, { headers: { authorization } });
    if (!response.ok) {
      throw new Error(
        `GET /events ตอบ ${response.status}: ${await response.text()}`,
      );
    }

    const page = (await response.json()) as { data?: unknown; total?: number };
    const rows = Array.isArray(page.data)
      ? (page.data as Array<Record<string, unknown>>)
      : [];

    events.push(...rows);
    if (rows.length < PAGE_SIZE) return events;
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const from = new Date(Date.now() - options.days * 86_400_000);

  console.log(`กระทบยอดเหตุการณ์ตั้งแต่ ${from.toISOString()} (${options.days} วัน)`);

  const events = await fetchEvents(requireSecretKey(), from);
  const ids = events
    .map((event) => event.id)
    .filter((id): id is string => typeof id === "string");

  const known = await findKnownEventIds(ids);
  const missing = events.filter(
    (event) => typeof event.id === "string" && !known.has(event.id),
  );

  console.log(`Opn มี ${events.length} เหตุการณ์ · เราเคยรับไว้ ${known.size}`);

  if (missing.length === 0) {
    console.log("✅ ไม่มีเหตุการณ์ที่หายไป");
    return;
  }

  console.log(`⚠️  มี ${missing.length} เหตุการณ์ที่เราไม่เคยได้รับ:`);
  for (const event of missing) {
    console.log(`   ${event.id} ${event.key} ${event.created_at}`);
  }

  if (!options.apply) {
    console.log("\nรันซ้ำด้วย --apply เพื่อประมวลผลเหตุการณ์เหล่านี้");
    return;
  }

  for (const event of missing) {
    // body ที่เก็บลง webhook_events จะไม่ตรงไบต์ต่อไบต์กับของที่เคยยิงมา
    // ซึ่งไม่กระทบความถูกต้อง เพราะเส้นทางนี้ไม่ได้ตรวจลายเซ็น (ดึงจาก API มาเอง)
    const result = await processOpnEvent(JSON.stringify(event));
    console.log(
      `   ${event.id} → ${result.status}${
        result.status === "processed" ? ` (${result.outcome})` : ""
      }`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
