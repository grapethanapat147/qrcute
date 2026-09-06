import { QrCode } from "lucide-react";
import type { QrMatrix } from "@/lib/qr/encode";
import { renderMatrixPath } from "@/lib/qr/render-svg";

export type QrPreviewProps = {
  /** เป็น null เมื่อยังกรอกไม่ครบหรือ encode ไม่ผ่าน */
  matrix: QrMatrix | null;
  error: string | null;
  /** ข้อความอธิบาย QR สำหรับ screen reader */
  description: string;
};

/**
 * แสดงผล QR อย่างเดียว ไม่มี logic
 *
 * วาดเป็น JSX จาก path data แทนที่จะยัด SVG string เข้า innerHTML
 * (renderSvg ที่คืน string ใช้เฉพาะตอนดาวน์โหลดไฟล์)
 *
 * สีใช้ token qr-paper/qr-ink ที่ไม่เปลี่ยนตาม theme ตาม business invariant ข้อ 5
 * เพราะ QR ที่สีกลับด้านจะสแกนไม่ติดกับเครื่องอ่านบางรุ่น
 */
export function QrPreview({ matrix, error, description }: QrPreviewProps) {
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

  if (matrix === null) {
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
    <div className="rounded-lg bg-qr-paper p-4 shadow-sm ring-1 ring-black/5">
      <svg
        role="img"
        aria-label={description}
        viewBox={`0 0 ${matrix.size} ${matrix.size}`}
        shapeRendering="crispEdges"
        className="h-auto w-full"
      >
        {/*
          ใส่สีเป็น attribute ตรง ๆ ไม่ใช้ utility class
          เพราะ (1) invariant ข้อ 5 บอกว่าสีนี้ห้ามเปลี่ยนตาม theme อยู่แล้ว
          และ (2) ถ้าใช้ class แล้วผู้ใช้ copy/save SVG ออกไป สีจะหายกลายเป็นดำทั้งแผ่น
          ค่าตรงนี้ต้องตรงกับ renderSvg() ที่ใช้ตอนดาวน์โหลด
        */}
        <rect width={matrix.size} height={matrix.size} fill="#ffffff" />
        <path d={renderMatrixPath(matrix)} fill="#000000" />
      </svg>
    </div>
  );
}
