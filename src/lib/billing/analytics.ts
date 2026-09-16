/**
 * สรุปสถิติการสแกน
 *
 * ทำเป็นฟังก์ชันบริสุทธิ์ทั้งหมด เพื่อให้ทดสอบตรรกะการนับได้โดยไม่ต้องมีฐานข้อมูล
 * และเพื่อไม่ต้องลากไลบรารีกราฟหนัก ๆ เข้ามา (docs/prd.md §5 ข้อ 6)
 */

import { provinceName } from "./provinces";

export type ScanRow = {
  qr_code_id: string;
  scanned_at: string;
  country: string | null;
  region: string | null;
  device_type: string | null;
  referrer_host: string | null;
};

export type DailyCount = { date: string; count: number };
export type LabelledCount = { label: string; count: number; share: number };

/** วันที่แบบ UTC — ต้องตรงกับที่ใช้ตอน hash IP ไม่งั้นการนับข้ามวันจะเพี้ยน */
function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * นับรายวันโดยเติมวันที่ไม่มีการสแกนให้เป็นศูนย์
 *
 * ถ้าไม่เติม กราฟจะบีบวันที่ว่างหายไปแล้วดูเหมือนมีคนสแกนทุกวัน
 * ซึ่งทำให้เจ้าของร้านอ่านผิดว่าธุรกิจไปได้ดีกว่าความจริง
 */
export function dailyCounts(
  scans: ScanRow[],
  days: number,
  now: Date,
): DailyCount[] {
  const counts = new Map<string, number>();
  for (const scan of scans) {
    const key = dateKey(scan.scanned_at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const result: DailyCount[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - offset);
    const key = day.toISOString().slice(0, 10);
    result.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return result;
}

function tally(
  values: Array<string | null>,
  fallbackLabel: string,
): LabelledCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = value === null || value.trim() === "" ? fallbackLabel : value;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = values.length;
  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      share: total === 0 ? 0 : count / total,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: "มือถือ",
  tablet: "แท็บเล็ต",
  desktop: "คอมพิวเตอร์",
  bot: "บอท",
  unknown: "ไม่ทราบ",
};

export function deviceBreakdown(scans: ScanRow[]): LabelledCount[] {
  return tally(
    scans.map((scan) => DEVICE_LABELS[scan.device_type ?? ""] ?? "ไม่ทราบ"),
    "ไม่ทราบ",
  );
}

export function regionBreakdown(scans: ScanRow[]): LabelledCount[] {
  // แปลงรหัส ISO เป็นชื่อจังหวัด ไม่งั้นเจ้าของร้านจะเห็น "10" แทน "กรุงเทพมหานคร"
  return tally(
    scans.map((scan) => provinceName(scan.region, scan.country)),
    "ไม่ระบุพื้นที่",
  );
}

export function referrerBreakdown(scans: ScanRow[]): LabelledCount[] {
  return tally(
    scans.map((scan) => scan.referrer_host),
    "สแกนจากป้ายโดยตรง",
  );
}

export type QrTitleLookup = Map<string, string>;

export function topQrCodes(
  scans: ScanRow[],
  titles: QrTitleLookup,
  limit = 5,
): LabelledCount[] {
  return tally(
    scans.map((scan) => titles.get(scan.qr_code_id) ?? "ไม่มีชื่อ"),
    "ไม่มีชื่อ",
  ).slice(0, limit);
}

/**
 * แยกบอทออกจากยอดที่แสดงเป็น "การสแกนจริง"
 *
 * ถ้ารวมบอทไว้ เจ้าของร้านจะเห็นตัวเลขสูงเกินจริงแล้วตัดสินใจธุรกิจผิด
 */
export function splitBots(scans: ScanRow[]): {
  human: ScanRow[];
  bots: ScanRow[];
} {
  const human: ScanRow[] = [];
  const bots: ScanRow[] = [];

  for (const scan of scans) {
    (scan.device_type === "bot" ? bots : human).push(scan);
  }

  return { human, bots };
}
