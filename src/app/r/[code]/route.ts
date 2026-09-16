import { after } from "next/server";
import { renderInterstitial } from "@/lib/dynamic/interstitial";
import { clientIp, hashIp, readScanContext } from "@/lib/dynamic/scan-context";
import { isValidShortcode } from "@/lib/dynamic/shortcode";
import {
  type ResolvedShortcode,
  recordScan,
  resolveShortcode,
} from "@/lib/dynamic/supabase-rpc";
import { siteConfig } from "@/lib/site";

/**
 * ปลายทางของ dynamic QR
 *
 * เส้นทางนี้อยู่บนป้ายจริงที่ลูกค้ายืนสแกนหน้าร้าน จึงมีเป้าหมายเดียว:
 * พาไปปลายทางให้เร็วที่สุด (p95 < 100ms) ทุกอย่างที่ไม่จำเป็นต่อเป้านั้นถูกเลื่อนไปทีหลัง
 *
 * ⚠️ เส้นทางนี้ใช้กับ dynamic QR เท่านั้น — static QR ฝังปลายทางไว้ในตัวเอง
 * และห้ามวิ่งผ่านที่นี่เด็ดขาด (business invariant ข้อ 1)
 */
export const runtime = "edge";
export const dynamic = "force-dynamic";

/** ผู้สแกนไม่ควรค้างอยู่นานกว่านี้ ต่อให้ฐานข้อมูลมีปัญหา */
const RESOLVE_TIMEOUT_MS = 2500;

function notFound(): Response {
  // 404 พร้อมข้อความไทยสั้น ๆ ดีกว่าโยนไปหน้าแรกให้ผู้ใช้งง
  return new Response("ไม่พบ QR นี้ — อาจถูกลบไปแล้วหรือพิมพ์รหัสผิด", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * หน้าคั่นสำหรับ QR ที่ถูกพักหรือหยุดทำงานแล้ว
 *
 * ตอบ 200 ตอนยังกดไปต่อได้ และ 410 ตอนหยุดทำงานถาวร
 * เพื่อให้ bot ที่ไล่เก็บลิงก์รู้ว่าอันไหนหมดอายุจริง โดยที่คนยังอ่านหน้าได้เหมือนกัน
 */
function interstitial(resolved: ResolvedShortcode): Response {
  const usable = resolved.state === "suspended" && resolved.target !== null;

  return new Response(
    renderInterstitial({
      kind: resolved.state === "suspended" ? "suspended" : "disabled",
      target: resolved.target,
      siteName: siteConfig.name,
      siteUrl: siteConfig.url,
    }),
    {
      status: usable ? 200 : 410,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await context.params;

  // ตรวจรูปแบบก่อนแตะฐานข้อมูล — คำขอขยะจะได้ไม่กินคอนเนกชัน
  if (!isValidShortcode(code)) return notFound();

  let resolved: ResolvedShortcode | null;
  try {
    resolved = await resolveShortcode(
      code,
      AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
    );
  } catch {
    return new Response("ระบบขัดข้องชั่วคราว ลองสแกนใหม่อีกครั้ง", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  if (resolved === null) return notFound();

  // บันทึกสถิติหลังตอบไปแล้ว ผู้สแกนจึงไม่ต้องรอ
  // ยอมให้สถิติหายถ้าล้มเหลว — ดีกว่าให้คนยืนรอหน้าร้าน
  after(async () => {
    try {
      const scan = readScanContext(request.headers);
      const ipHashHex = await hashIp(
        clientIp(request.headers),
        code,
        process.env.SCAN_IP_SALT ?? "",
        new Date(),
      );

      await recordScan({
        code,
        country: scan.country,
        region: scan.region,
        deviceType: scan.deviceType,
        referrerHost: scan.referrerHost,
        ipHashHex,
      });
    } catch {
      // ตั้งใจกลืน — สถิติพลาดหนึ่งครั้งไม่ใช่เรื่องที่ต้องรบกวนผู้ใช้
    }
  });

  // QR ที่เจ้าของหยุดจ่ายไม่ใช่ 404 — คนสแกนต้องยังมีทางไปต่อ (ADR 0008)
  if (resolved.state !== "active" || resolved.target === null) {
    return interstitial(resolved);
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: resolved.target,
      // ห้าม cache เด็ดขาด ไม่งั้นแก้ปลายทางแล้วคนที่เคยสแกนจะยังไปที่เดิม
      // ซึ่งทำลายสัญญาหลักของ dynamic QR
      "cache-control": "no-store, no-cache, must-revalidate",
      referrer: siteConfig.url,
    },
  });
}
