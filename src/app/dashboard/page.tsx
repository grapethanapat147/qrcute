import { QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { ClaimDrafts } from "./claim-drafts";
import { QrCard, type QrCardData, type QrVersion } from "./qr-card";

export const metadata: Metadata = {
  title: "QR ของฉัน",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // RLS กรองให้เหลือเฉพาะของผู้ใช้คนนี้อยู่แล้ว ไม่ต้องใส่ where owner_id ซ้ำ
  const [{ data: codes }, { data: versions }] = await Promise.all([
    supabase
      .from("qr_codes")
      .select(
        "id, title, kind, qr_type, shortcode, current_target, status, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("qr_versions")
      .select("qr_code_id, version, target_url, created_at")
      .order("version", { ascending: false }),
  ]);

  const versionsByQr = new Map<string, QrVersion[]>();
  for (const row of versions ?? []) {
    const list = versionsByQr.get(row.qr_code_id) ?? [];
    list.push({
      version: row.version,
      target_url: row.target_url,
      created_at: row.created_at,
    });
    versionsByQr.set(row.qr_code_id, list);
  }

  const items: QrCardData[] = (codes ?? []).map((code) => ({
    ...code,
    kind: code.kind as "static" | "dynamic",
    versions: versionsByQr.get(code.id) ?? [],
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <QrCode className="size-5 text-primary" aria-hidden />
            {siteConfig.name}
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              ออกจากระบบ
            </Button>
          </form>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <ClaimDrafts />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">QR ของฉัน</h1>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/stats">สถิติการสแกน</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/">สร้าง QR ใหม่</Link>
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <QrCode
              className="mx-auto size-12 text-muted-foreground"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="mt-3 font-medium">ยังไม่มี QR ในบัญชี</p>
            <p className="mt-1 text-sm text-muted-foreground">
              สร้าง QR จากหน้าแรกแล้วกดบันทึกเข้าบัญชี จะกลับมาแก้ทีหลังได้
            </p>
            <Button asChild className="mt-5">
              <Link href="/">ไปสร้าง QR</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((qr) => (
              <QrCard key={qr.id} qr={qr} origin={siteConfig.url} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
