"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { QrMatrix } from "@/lib/qr/encode";
import { PNG_SIZES, renderPngBlob } from "@/lib/qr/render-png";
import { renderSvg } from "@/lib/qr/render-svg";

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
  /** ใช้ตั้งชื่อไฟล์ เช่น qr-wifi */
  filenameBase: string;
};

export function QrDownload({ matrix, filenameBase }: QrDownloadProps) {
  const [busySize, setBusySize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = matrix === null;

  async function downloadPng(size: number) {
    if (matrix === null) return;
    setBusySize(size);
    setError(null);
    try {
      const blob = await renderPngBlob(matrix, { size });
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
    const blob = new Blob([renderSvg(matrix)], {
      type: "image/svg+xml;charset=utf-8",
    });
    triggerDownload(blob, `${filenameBase}.svg`);
  }

  return (
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
          aria-label="ดาวน์โหลดไฟล์ SVG สำหรับงานพิมพ์"
        >
          <Download aria-hidden />
          SVG
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        SVG เป็นไฟล์เวกเตอร์ ขยายเท่าไรก็ไม่แตก เหมาะกับงานพิมพ์มากกว่า PNG
      </p>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
