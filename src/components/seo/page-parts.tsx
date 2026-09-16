import Link from "next/link";
import type { FaqItem } from "@/lib/seo/type-pages";

/**
 * ชิ้นส่วนที่หน้า /qr/[type] กับ /use-case/[slug] ใช้ร่วมกัน
 *
 * ทำเป็น component แทนที่จะ copy JSX เพราะโครง heading มีผลกับ SEO โดยตรง
 * ถ้าหน้าไหนเผลอใช้ h3 แทน h2 ลำดับหัวข้อจะพัง และ screen reader ก็อ่านผิดลำดับ
 */

export function Breadcrumbs({
  trail,
}: {
  trail: { name: string; path: string }[];
}) {
  return (
    <nav aria-label="เส้นทางนำทาง" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1">
              {last ? (
                <span aria-current="page">{crumb.name}</span>
              ) : (
                <>
                  <Link href={crumb.path} className="hover:text-foreground">
                    {crumb.name}
                  </Link>
                  <span aria-hidden>/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepList({
  steps,
}: {
  steps: { name: string; detail: string }[];
}) {
  return (
    <ol className="mt-6 space-y-5">
      {steps.map((step, index) => (
        <li key={step.name} className="flex gap-4">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            {index + 1}
          </span>
          <div>
            <h3 className="font-medium">{step.name}</h3>
            <p className="mt-1 text-muted-foreground">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * FAQ เป็น details/summary ล้วน ไม่ใช้ JavaScript
 *
 * เปิดปิดได้ตั้งแต่ก่อน hydrate และคีย์บอร์ดใช้ได้ครบโดยไม่ต้องเขียนอะไรเพิ่ม
 * ซึ่งสำคัญกับหน้าที่คนมาจากผลค้นหาแล้วปิดทิ้งภายในไม่กี่วินาที
 */
export function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <div className="mt-6 divide-y rounded-lg border">
      {items.map((item) => (
        <details key={item.question} className="group px-5 py-4">
          <summary className="cursor-pointer list-none font-medium marker:content-none">
            <span className="flex items-start justify-between gap-4">
              {item.question}
              <span
                aria-hidden
                className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
              >
                +
              </span>
            </span>
          </summary>
          <p className="mt-3 text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function RelatedLinks({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-3">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="block rounded-lg border p-4 text-sm font-medium hover:border-primary hover:text-primary"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
