import { Lock } from "lucide-react";
import Link from "next/link";
import {
  type GeneratorGatedFeature,
  UPGRADE_HREF,
  UPGRADE_PROMPT,
} from "@/lib/billing/plan-gate";

/**
 * กล่องชวนอัปเกรดที่แทนที่ตัวควบคุมซึ่งยังใช้ไม่ได้
 *
 * ตั้งใจแสดงแทนที่จะซ่อนไปเลย เพราะถ้าซ่อน คนจะไม่มีวันรู้ว่ามีของนี้อยู่
 * และจะไม่มีเหตุผลให้อัปเกรด แต่ก็ไม่ทำเป็นปุ่มที่กดแล้วเด้ง error
 * เพราะการให้คนกดแล้วโดนปฏิเสธเป็นประสบการณ์ที่แย่กว่าการบอกไว้ตั้งแต่แรก
 */
export function UpgradeNotice({ feature }: { feature: GeneratorGatedFeature }) {
  const prompt = UPGRADE_PROMPT[feature];

  return (
    <div className="rounded-lg border border-dashed p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Lock className="size-4 text-muted-foreground" aria-hidden />
        {prompt.title}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{prompt.detail}</p>
      <Link
        href={UPGRADE_HREF}
        className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
      >
        ดูแพ็กเกจและราคา
      </Link>
    </div>
  );
}
