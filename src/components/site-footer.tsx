import Link from "next/link";
import { TYPE_PAGE_LIST } from "@/lib/seo/type-pages";
import { USE_CASES } from "@/lib/seo/use-cases";
import { siteConfig } from "@/lib/site";

/**
 * แถบล่างของทุกหน้า — ทำหน้าที่เป็นโครง internal link ด้วย
 *
 * docs/seo.md §6 วางโครงแบบ hub-and-spoke ไว้ และห้าม anchor text แบบ
 * "อ่านเพิ่มเติม" ลอย ๆ ลิงก์ทุกอันที่นี่จึงใช้ keyword ของหน้าปลายทางตรง ๆ
 *
 * ดึงรายการจาก TYPE_PAGE_LIST กับ USE_CASES ไม่ hardcode
 * เพิ่มหน้าใหม่แล้วลิงก์ขึ้นเอง และไม่มีทางลิงก์ไปหน้าที่ไม่มีจริง
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-muted/30">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <nav aria-labelledby="footer-types">
          <h2 id="footer-types" className="text-sm font-semibold">
            สร้าง QR Code แยกตามประเภท
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {TYPE_PAGE_LIST.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/qr/${page.slug}`}
                  className="hover:text-foreground"
                >
                  {page.h1}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-use-cases">
          <h2 id="footer-use-cases" className="text-sm font-semibold">
            QR Code แยกตามประเภทธุรกิจ
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {USE_CASES.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/use-case/${page.slug}`}
                  className="hover:text-foreground"
                >
                  {page.h1}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">{siteConfig.name}</p>
          <p className="mt-3">{siteConfig.description}</p>
          <p className="mt-6">
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
