"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import type { ErrorCorrectionLevel } from "@/lib/qr/encode";
import {
  LOGO_ACCEPTED_TYPES,
  LOGO_FILE_ERROR_MESSAGES,
  MIN_LOGO_RATIO,
  maxLogoRatio,
  type QrLogo,
  validateLogoFile,
} from "@/lib/qr/logo";

export type QrLogoFieldProps = {
  logo: QrLogo | null;
  level: ErrorCorrectionLevel;
  onChange: (logo: QrLogo | null) => void;
};

export function QrLogoField({ logo, level, onChange }: QrLogoFieldProps) {
  const sizeId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const maxRatio = maxLogoRatio(level);
  const atLimit = logo !== null && logo.sizeRatio >= maxRatio - 0.001;

  function handleFile(file: File | undefined) {
    if (file === undefined) return;

    const fileError = validateLogoFile(file);
    if (fileError !== null) {
      setError(LOGO_FILE_ERROR_MESSAGES[fileError]);
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      // เริ่มที่ขนาดกลาง ๆ ของช่วงที่ระดับปัจจุบันยอมให้ ไม่ใช่ใหญ่สุดทันที
      onChange({
        src: reader.result,
        sizeRatio: (MIN_LOGO_RATIO + maxRatio) / 2,
      });
    };
    reader.onerror = () => setError("อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      <Label htmlFor={sizeId}>โลโก้ตรงกลาง</Label>

      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPTED_TYPES.join(",")}
        className="sr-only"
        aria-label="เลือกไฟล์โลโก้"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          // ล้างค่าเพื่อให้เลือกไฟล์เดิมซ้ำแล้วยัง trigger onChange
          event.target.value = "";
        }}
      />

      {logo === null ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp aria-hidden />
          เลือกไฟล์โลโก้
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border bg-qr-paper">
              {/* biome-ignore lint/performance/noImgElement: data URI ฝั่ง client ไม่ผ่าน image optimizer */}
              <img
                src={logo.src}
                alt="ตัวอย่างโลโก้ที่เลือก"
                className="max-h-full max-w-full"
              />
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              เปลี่ยนไฟล์
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setError(null);
              }}
            >
              <Trash2 aria-hidden />
              เอาออก
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={sizeId}>
              ขนาดโลโก้ ({Math.round(logo.sizeRatio * 100)}% ของความกว้าง QR)
            </Label>
            <input
              id={sizeId}
              type="range"
              min={Math.round(MIN_LOGO_RATIO * 100)}
              max={Math.round(maxRatio * 100)}
              step={1}
              value={Math.round(logo.sizeRatio * 100)}
              onChange={(event) =>
                onChange({
                  ...logo,
                  sizeRatio: Number(event.target.value) / 100,
                })
              }
              className="w-full accent-primary"
            />
            <p className="text-sm text-muted-foreground">
              {atLimit
                ? `ใหญ่สุดเท่าที่ระดับความทนทานตอนนี้รับไหวแล้ว — ถ้าอยากได้ใหญ่กว่านี้ ให้เลือก “ต้องทนที่สุด” ในแท็บข้อมูล`
                : `ขยายได้ถึง ${Math.round(maxRatio * 100)}% ที่ระดับความทนทานตอนนี้`}
            </p>
          </div>
        </>
      )}

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
