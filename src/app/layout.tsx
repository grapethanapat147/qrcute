import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { assertUrlConfigured, siteConfig } from "@/lib/site";
import "./globals.css";

const thaiSans = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai-sans",
  display: "swap",
});

// ต้องเรียกก่อนสร้าง metadata — canonical, og:url และ sitemap ล้วนงอกจาก siteConfig.url
// ถ้าค่านั้นเป็น localhost บน production แล้วปล่อยผ่าน จะไม่มี error ให้ใครเห็น
// แต่ Google เก็บ index ไม่ได้ทั้งเว็บ (ดู docs/decisions/0002-brand-placeholder.md)
assertUrlConfigured();

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — สร้าง QR Code ฟรี ไม่มีวันหมดอายุ`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: siteConfig.name,
    url: siteConfig.url,
    title: `${siteConfig.name} — สร้าง QR Code ฟรี ไม่มีวันหมดอายุ`,
    description: siteConfig.description,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131720" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={thaiSans.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        {children}
      </body>
    </html>
  );
}
