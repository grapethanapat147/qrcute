import { TriangleAlert } from "lucide-react";
import {
  PROMPTPAY_TARGET_LABELS,
  type PromptPayTargetType,
} from "@/lib/qr/promptpay";

export type PromptPaySummaryProps = {
  targetType: PromptPayTargetType;
  target: string;
  amount: string;
};

const BAHT_FORMATTER = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
});

/**
 * ให้ผู้ใช้ตรวจข้อมูลผู้รับก่อนดาวน์โหลด (docs/prd.md §2.1)
 *
 * QR พร้อมเพย์ที่ผิดหมายถึงเงินเข้าผิดบัญชี และเมื่อพิมพ์ติดหน้าร้านไปแล้ว
 * ความผิดพลาดจะอยู่ไปอีกนาน — การให้อ่านทวนก่อนจึงคุ้มกว่าความรำคาญ
 */
export function PromptPaySummary({
  targetType,
  target,
  amount,
}: PromptPaySummaryProps) {
  const parsedAmount = Number(amount.trim());
  const hasAmount = amount.trim() !== "" && Number.isFinite(parsedAmount);

  return (
    <div className="space-y-3">
      <dl className="rounded-lg border bg-muted/30 p-4 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">
            {PROMPTPAY_TARGET_LABELS[targetType]}
          </dt>
          <dd className="font-medium tabular-nums">{target}</dd>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">จำนวนเงิน</dt>
          <dd className="font-medium tabular-nums">
            {hasAmount ? (
              BAHT_FORMATTER.format(parsedAmount)
            ) : (
              <span className="font-normal text-muted-foreground">
                ผู้จ่ายกรอกเอง
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
        <TriangleAlert
          className="mt-0.5 size-4 shrink-0 text-warning-foreground"
          aria-hidden
        />
        <p className="text-warning-foreground">
          <strong className="font-medium">ทดสอบก่อนใช้จริง</strong> — สแกน QR นี้ด้วย
          แอปธนาคารของคุณเองและตรวจว่าชื่อบัญชีผู้รับถูกต้อง ก่อนนำไปพิมพ์หรือติดหน้าร้าน
        </p>
      </div>
    </div>
  );
}
