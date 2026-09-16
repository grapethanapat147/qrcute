import { ChartNoAxesColumn, QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BreakdownList } from "@/components/dashboard/breakdown-list";
import { ScanBars } from "@/components/dashboard/scan-bars";
import { Button } from "@/components/ui/button";
import {
  dailyCounts,
  deviceBreakdown,
  referrerBreakdown,
  regionBreakdown,
  type ScanRow,
  splitBots,
  topQrCodes,
} from "@/lib/billing/analytics";
import { getQuota, toContext } from "@/lib/billing/entitlements";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "สถิติการสแกน",
  robots: { index: false, follow: false },
};

/** กันไม่ให้ดึงแถวมามากจนหน้าช้า — แผนฟรีเก็บแค่ 7 วันอยู่แล้ว */
const MAX_ROWS = 5000;

export default async function StatsPage() {
  const supabase = await createClient();
  const now = new Date();

  const [{ data: subscription }, { data: grants }, { data: codes }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan, status, grace_until")
        .maybeSingle(),
      supabase.from("entitlements").select("feature, quota, expires_at"),
      supabase.from("qr_codes").select("id, title"),
    ]);

  // จำนวนวันที่ดูย้อนหลังได้ขึ้นกับแพ็กเกจ — ผ่านชั้นสิทธิ์เสมอ ไม่เช็คแพ็กเกจตรง ๆ
  const days = Math.min(
    365,
    getQuota(toContext(subscription, grants ?? [], now), "analytics_days"),
  );

  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  // RLS กรองให้เหลือเฉพาะ scan ของ QR ที่ผู้ใช้เป็นเจ้าของอยู่แล้ว
  const { data: rawScans } = await supabase
    .from("scans")
    .select(
      "qr_code_id, scanned_at, country, region, device_type, referrer_host",
    )
    .gte("scanned_at", since.toISOString())
    .order("scanned_at", { ascending: false })
    .limit(MAX_ROWS);

  const scans = (rawScans ?? []) as ScanRow[];
  const { human, bots } = splitBots(scans);
  const titles = new Map((codes ?? []).map((code) => [code.id, code.title]));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <QrCode className="size-5 text-primary" aria-hidden />
            {siteConfig.name}
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">QR ของฉัน</Link>
          </Button>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ChartNoAxesColumn className="size-6 text-primary" aria-hidden />
          สถิติการสแกน
        </h1>
        <p className="mt-2 text-muted-foreground">
          ย้อนหลัง {days} วันตามแพ็กเกจปัจจุบัน
        </p>

        {scans.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">ยังไม่มีใครสแกน</p>
            <p className="mt-1 text-sm text-muted-foreground">
              สถิติจะขึ้นเมื่อมีคนสแกน QR แบบแก้ปลายทางได้ — QR แบบชี้ตรงนับไม่ได้
              เพราะไม่ได้วิ่งผ่านเรา
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <section className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-medium">การสแกนรายวัน</h2>
                <p className="text-sm text-muted-foreground">
                  รวม {human.length} ครั้ง
                  {bots.length > 0 && ` · ไม่นับบอทอีก ${bots.length} ครั้ง`}
                </p>
              </div>
              <ScanBars data={dailyCounts(human, days, now)} />
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <BreakdownList
                title="QR ที่ถูกสแกนมากที่สุด"
                items={topQrCodes(human, titles)}
              />
              <BreakdownList
                title="อุปกรณ์ที่ใช้สแกน"
                items={deviceBreakdown(human)}
              />
              <BreakdownList title="พื้นที่" items={regionBreakdown(human)} />
              <BreakdownList
                title="สแกนมาจากไหน"
                items={referrerBreakdown(human)}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
