"use client";

import { Download, Printer } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import type { QrMatrix } from "@/lib/qr/encode";
import {
  moduleSizeMm,
  PRINT_PRESETS,
  type PrintPreset,
  printWarning,
  recommendedScanDistanceCm,
} from "@/lib/qr/print";
import { renderPdfBlob } from "@/lib/qr/render-pdf";
import { PNG_SIZES, renderPngBlob } from "@/lib/qr/render-png";
import { renderSvg } from "@/lib/qr/render-svg";
import type { QrStyle } from "@/lib/qr/style";

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type QrDownloadProps = {
  matrix: QrMatrix | null;
  style: QrStyle;
  /** ใช้ตั้งชื่อไฟล์ เช่น qr-wifi */
  filenameBase: string;
};

export function QrDownload({ matrix, style, filenameBase }: QrDownloadProps) {
  const presetId = useId();
  const [busySize, setBusySize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<PrintPreset>(
    () => PRINT_PRESETS[0] as PrintPreset,
  );

  const disabled = matrix === null;

  async function downloadPng(size: number) {
    if (matrix === null) return;
    setBusySize(size);
    setError(null);
    try {
      const blob = await renderPngBlob(matrix, { size, style });
      triggerDownload(blob, `${filenameBase}-${size}.png`);
    } catch {
      setError("ดาวน์โหลด PNG ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusySize(null);
    }
  }

  function downloadSvg() {
    if (matrix === null) return;
    setError(null);
    const blob = new Blob([renderSvg(matrix, { style })], {
      type: "image/svg+xml;charset=utf-8",
    });
    triggerDownload(blob, `${filenameBase}.svg`);
  }

  function downloadPdf() {
    if (matrix === null) return;
    setError(null);
    try {
      const blob = renderPdfBlob(matrix, {
        style,
        pageWidthMm: preset.pageWidthMm,
        pageHeightMm: preset.pageHeightMm,
        qrSizeMm: preset.qrSizeMm,
      });
      triggerDownload(blob, `${filenameBase}-${preset.id}.pdf`);
    } catch {
      setError("สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  const modulesMm =
    matrix === null ? null : moduleSizeMm(preset.qrSizeMm, matrix.size);
  const warning =
    matrix === null ? null : printWarning(preset.qrSizeMm, matrix.size);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {PNG_SIZES.map((size) => (
            <Button
              key={size}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || busySize !== null}
              onClick={() => void downloadPng(size)}
              aria-label={`ดาวน์โหลด PNG ขนาด ${size} พิกเซล`}
            >
              <Download aria-hidden />
              PNG {size}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={downloadSvg}
            aria-label="ดาวน์โหลดไฟล์ SVG"
          >
            <Download aria-hidden />
            SVG
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Printer className="size-4" aria-hidden />
          ไฟล์สำหรับส่งโรงพิมพ์
        </p>

        <div className="space-y-1.5">
          <Label htmlFor={presetId}>ขนาดงานพิมพ์</Label>
          <Select
            id={presetId}
            value={preset.id}
            onChange={(event) => {
              const next = PRINT_PRESETS.find(
                (item) => item.id === event.target.value,
              );
              if (next !== undefined) setPreset(next);
            }}
          >
            {PRINT_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
          <p className="text-sm text-muted-foreground">{preset.description}</p>
        </div>

        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">ขนาด QR บนแผ่น</dt>
            <dd className="tabular-nums">{preset.qrSizeMm} มม.</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">ขนาดต่อหนึ่งจุด</dt>
            <dd className="tabular-nums">
              {modulesMm === null ? "—" : `${modulesMm.toFixed(2)} มม.`}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">ระยะสแกนที่แนะนำ</dt>
            <dd className="tabular-nums">
              ~{recommendedScanDistanceCm(preset.qrSizeMm)} ซม.
            </dd>
          </div>
        </dl>

        {warning !== null && (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
            {warning}
          </p>
        )}

        <Button
          type="button"
          className="w-full"
          disabled={disabled}
          onClick={downloadPdf}
          aria-label="ดาวน์โหลด PDF สำหรับงานพิมพ์"
        >
          <Download aria-hidden />
          ดาวน์โหลด PDF
        </Button>

        <p className="text-sm text-muted-foreground">
          PDF เป็นเวกเตอร์ ขนาดตรงตามที่ระบุเป็นมิลลิเมตร และใช้สี CMYK ที่โรงพิมพ์ต้องการ
          {style.gradientDirection !== "none" && (
            <>
              {" "}
              <strong className="font-medium text-foreground">
                ไฟล์ PDF จะใช้สีเดียว ไม่ไล่เฉด
              </strong>{" "}
              เพราะเฉดสีในระบบ CMYK มักเกิดแถบสีเวลาพิมพ์จริง และทำให้ปลายด้านอ่อน
              ตัดกับพื้นน้อยลงจนเสี่ยงสแกนไม่ติด
            </>
          )}
        </p>
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
