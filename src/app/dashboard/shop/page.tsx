import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { effectivePlan, toContext } from "@/lib/billing/entitlements";
import { readShopLinks } from "@/lib/shop/page";
import { absoluteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { ShopForm } from "./shop-form";

export const metadata: Metadata = {
  title: "หน้าร้านของฉัน",
  robots: { index: false, follow: false },
};

export default async function ShopEditorPage() {
  const supabase = await createClient();
  const [{ data: page }, { data: subscription }] = await Promise.all([
    supabase
      .from("shop_pages")
      .select("slug, name, description, phone, hours, links")
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan, status, grace_until")
      .maybeSingle(),
  ]);
  const isPro = effectivePlan(toContext(subscription, [])) !== "free";
  const publicUrl = page === null ? null : absoluteUrl(`/s/${page.slug}`);

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไป QR ของฉัน
      </Link>
      <h1 className="mt-4 text-2xl font-bold">หน้าร้านของฉัน</h1>
      <p className="mt-2 text-muted-foreground">
        หน้าเว็บสั้น ๆ หนึ่งหน้าที่รวมลิงก์ เบอร์โทร และเวลาเปิดปิดของร้าน ไม่ต้องมีเว็บไซต์ของตัวเอง
        ทำ QR ชี้มาที่หน้านี้แล้วแก้ข้อมูลได้ตลอดโดยไม่ต้องพิมพ์ป้ายใหม่
      </p>

      {publicUrl !== null && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border p-4 text-sm">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener"
            className="font-medium underline"
          >
            {publicUrl}
          </a>
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/qr/url?type=url&url=${encodeURIComponent(publicUrl)}`}
            >
              สร้าง QR ไปหน้านี้
            </Link>
          </Button>
        </div>
      )}

      <div className="mt-8">
        {isPro ? (
          <ShopForm
            initial={
              page === null
                ? null
                : { ...page, links: readShopLinks(page.links) }
            }
          />
        ) : (
          <div className="rounded-lg border border-dashed p-6">
            <p className="font-medium">หน้าร้านอยู่ในแพ็กเกจ Pro</p>
            <p className="mt-2 text-sm text-muted-foreground">
              เพราะเป็นหน้าที่เราต้องเปิดให้ลูกค้าของคุณเข้าได้ตลอดเวลา
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/pricing">ดูแพ็กเกจและราคา</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
