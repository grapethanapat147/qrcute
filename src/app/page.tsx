import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold">
            <QrCode className="size-5 text-primary" aria-hidden />
            {siteConfig.name}
          </span>
          <Button variant="ghost" size="sm" disabled>
            เข้าสู่ระบบ
          </Button>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
        <h1 className="max-w-3xl text-4xl font-bold sm:text-5xl">
          สร้าง QR Code ฟรี ไม่มีวันหมดอายุ
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {siteConfig.description}
        </p>

        {/* ตัว generator จะมาแทนที่กล่องนี้ใน Phase 1 — ดู docs/roadmap.md */}
        <div className="mt-10 grid gap-6 rounded-xl border border-dashed p-8 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <p className="font-medium">พื้นที่ของ generator</p>
            <p className="text-sm text-muted-foreground">
              Phase 1 จะวางฟอร์มสร้าง QR ไว้ตรงนี้ โดย render ฝั่ง client ทั้งหมด
            </p>
          </div>
          <div
            className="grid aspect-square w-40 place-items-center rounded-lg bg-qr-paper text-qr-ink"
            aria-hidden
          >
            <QrCode className="size-20" strokeWidth={1.25} />
          </div>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto w-full max-w-6xl px-4 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {siteConfig.name}
        </div>
      </footer>
    </div>
  );
}
