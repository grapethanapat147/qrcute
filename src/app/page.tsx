import { QrCode } from "lucide-react";
import { Suspense } from "react";
import { QrGenerator } from "@/components/qr/qr-generator";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

function GeneratorFallback() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
      <div className="aspect-square animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

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

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <h1 className="max-w-3xl text-4xl font-bold sm:text-5xl">
          สร้าง QR Code ฟรี ไม่มีวันหมดอายุ
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {siteConfig.description}
        </p>

        <div className="mt-10">
          {/*
            useSearchParams ต้องอยู่ใต้ Suspense ไม่งั้น client component tree
            ทั้งก้อนจะหลุดจากการ prerender (ดู docs ของ Next 16)
          */}
          <Suspense fallback={<GeneratorFallback />}>
            <QrGenerator />
          </Suspense>
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
