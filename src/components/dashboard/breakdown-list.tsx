import type { LabelledCount } from "@/lib/billing/analytics";

const PERCENT = new Intl.NumberFormat("th-TH", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function BreakdownList({
  title,
  items,
  emptyText = "ยังไม่มีข้อมูล",
}: {
  title: string;
  items: LabelledCount[];
  emptyText?: string;
}) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">{title}</h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.label} className="space-y-1">
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {item.count} · {PERCENT.format(item.share)}
                </span>
              </div>
              {/* แถบสัดส่วนแทนกราฟวงกลม — อ่านง่ายกว่าบนจอมือถือแคบ ๆ */}
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round(item.share * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
