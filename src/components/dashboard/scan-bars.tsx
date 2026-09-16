import type { DailyCount } from "@/lib/billing/analytics";

/**
 * กราฟแท่งรายวันแบบ SVG เขียนเอง
 *
 * ไม่ลากไลบรารีกราฟเข้ามา (docs/prd.md §5 ข้อ 6) เพราะต้องการแค่แท่งกับแกน
 * และไลบรารีกราฟทั่วไปหนักกว่าโค้ดทั้งหน้านี้รวมกัน
 */
export function ScanBars({ data }: { data: DailyCount[] }) {
  const max = Math.max(1, ...data.map((point) => point.count));
  const width = 100;
  const height = 32;
  const gap = 0.6;
  const barWidth = data.length === 0 ? 0 : width / data.length - gap;

  const first = data[0];
  const last = data.at(-1);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(
      new Date(iso),
    );

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`กราฟการสแกนรายวัน สูงสุด ${max} ครั้งต่อวัน`}
        className="h-32 w-full"
      >
        <title>การสแกนรายวัน</title>
        {data.map((point, index) => {
          const barHeight = (point.count / max) * height;
          return (
            <rect
              key={point.date}
              x={index * (barWidth + gap)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={0.4}
              className="fill-primary"
            />
          );
        })}
      </svg>

      <figcaption className="flex justify-between text-xs text-muted-foreground">
        <span>{first === undefined ? "" : formatDate(first.date)}</span>
        <span>สูงสุด {max} ครั้ง/วัน</span>
        <span>{last === undefined ? "" : formatDate(last.date)}</span>
      </figcaption>
    </figure>
  );
}
