import { QrCode } from "lucide-react";

export type QrPreviewProps = {
  /** data URI ของ SVG — เป็น null เมื่อยังกรอกไม่ครบหรือ encode ไม่ผ่าน */
  src: string | null;
  error: string | null;
  warning: string | null;
  /** ข้อความอธิบาย QR สำหรับ screen reader */
  description: string;
};

/**
 * แสดงผล QR อย่างเดียว ไม่มี logic
 *
 * ใช้ <img> ที่ชี้ไป data URI ของ SVG ตัวเดียวกับที่ใช้ตอนดาวน์โหลดและตอนแปลงเป็น PNG
 * ทำให้สิ่งที่ผู้ใช้เห็นกับไฟล์ที่ได้เป็นของชิ้นเดียวกันเสมอ
 *
 * พื้นหลังกล่องเป็นสีขาวคงที่ ไม่เปลี่ยนตาม theme ของเว็บ (business invariant ข้อ 5)
 */
export function QrPreview({
  src,
  error,
  warning,
  description,
}: QrPreviewProps) {
  if (error !== null) {
    return (
      <div
        role="alert"
        className="grid aspect-square w-full place-items-center rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive"
      >
        {error}
      </div>
    );
  }

  if (src === null) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
        <div className="space-y-3 text-muted-foreground">
          <QrCode className="mx-auto size-16" strokeWidth={1.25} aria-hidden />
          <p className="text-sm">กรอกข้อมูลด้านซ้ายเพื่อดูตัวอย่าง QR</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-qr-paper p-4 shadow-sm ring-1 ring-black/5">
        {/* biome-ignore lint/performance/noImgElement: ภาพสร้างจาก data URI ฝั่ง client ไม่ผ่าน image optimizer */}
        <img src={src} alt={description} className="h-auto w-full" />
      </div>

      {warning !== null && (
        <output className="block rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
          {warning}
        </output>
      )}
    </div>
  );
}
