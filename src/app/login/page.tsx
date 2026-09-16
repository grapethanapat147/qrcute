import { QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  // หน้าเข้าสู่ระบบไม่มีคุณค่าต่อการค้นหา และไม่ควรแย่ง crawl budget กับหน้าที่ต้อง rank
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/dashboard";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
        <QrCode className="size-5 text-primary" aria-hidden />
        {siteConfig.name}
      </Link>

      <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
      <p className="mt-2 mb-6 text-muted-foreground">
        เข้าสู่ระบบเพื่อจัดการ QR ที่แก้ปลายทางได้ และดูสถิติการสแกน
      </p>

      <LoginForm next={next} />
    </main>
  );
}
