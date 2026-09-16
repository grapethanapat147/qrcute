import { QrCode } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/lib/site";

/**
 * แถบบนของทุกหน้า
 *
 * แยกออกมาจาก app/page.tsx ตอนทำหน้า SEO เพราะหน้า /qr/[type] และ
 * /use-case/[slug] ต้องใช้ชุดเดียวกัน ถ้า copy ไปแต่ละหน้าจะเพี้ยนกันทีละนิด
 */
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <QrCode className="size-5 text-primary" aria-hidden />
          {siteConfig.name}
        </Link>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    </header>
  );
}
