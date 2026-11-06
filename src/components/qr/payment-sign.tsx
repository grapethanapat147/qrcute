"use client";

import { Download } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { QrMatrix } from "@/lib/qr/encode";
import type { RasterImage } from "@/lib/qr/raster";
import { renderSignPngBlob } from "@/lib/qr/render-png";
import {
  isSignEmpty,
  type PaymentSign,
  SIGN_ACCOUNT_NAME_MAX,
  SIGN_SHOP_NAME_MAX,
} from "@/lib/qr/sign";
import type { QrStyle } from "@/lib/qr/style";
import { triggerDownload } from "./qr-download";
import { useDebouncedValue } from "./use-debounced-value";

type PaymentSignPanelProps = {
  matrix: QrMatrix | null;
  style: QrStyle;
  band: RasterImage | null;
  sign: PaymentSign;
  onChange: (sign: PaymentSign) => void;
};

/**
 * ป้ายรับเงินพร้อมเพย์ — ใช้ได้ทุกแพ็กเกจในรูป PNG ส่วน PDF ส่งโรงพิมพ์อยู่ใน QrDownload (Pro)
 * พรีวิวคือไฟล์ PNG ตัวจริงที่จะดาวน์โหลด ไม่ใช่ HTML จำลอง จึงเห็นการตัดบรรทัดไทยตรงกับที่พิมพ์
 */
export function PaymentSignPanel({
  matrix,
  style,
  band,
  sign,
  onChange,
}: PaymentSignPanelProps) {
  const shopId = useId();
  const accountId = useId();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // วาดป้ายทั้งแผ่นหนักกว่าวาด QR จึงรอให้พิมพ์เสร็จก่อน
  const debouncedSign = useDebouncedValue(sign);
  const empty = isSignEmpty(debouncedSign);

  useEffect(() => {
    if (matrix === null || empty) {
      setBlob(null);
      return;
    }
    let cancelled = false;
    renderSignPngBlob(matrix, {
      style,
      bandImageSrc: band?.dataUrl ?? null,
      sign: debouncedSign,
    })
      .then((result) => {
        if (!cancelled) {
          setBlob(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("วาดป้ายไม่สำเร็จ ลองใหม่อีกครั้ง");
      });
    return () => {
      cancelled = true;
    };
  }, [matrix, style, band, debouncedSign, empty]);

  useEffect(() => {
    if (blob === null) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return (
    <fieldset className="space-y-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">ป้ายรับเงิน (ไม่บังคับ)</legend>
      <p className="text-sm text-muted-foreground">
        ใส่ชื่อร้านและชื่อบัญชีแล้วได้ป้ายตั้งโต๊ะขนาด A6 พร้อมพิมพ์
        ลูกค้าจะเทียบชื่อบัญชีบนป้ายกับชื่อที่แอปธนาคารแสดง ถ้ามีคนแปะ QR อื่นทับก็จับได้
      </p>

      <div className="space-y-1.5">
        <Label htmlFor={shopId}>ชื่อร้าน</Label>
        <Input
          id={shopId}
          value={sign.shopName}
          maxLength={SIGN_SHOP_NAME_MAX}
          placeholder="ร้านป้าแดง ข้าวมันไก่"
          onChange={(event) =>
            onChange({ ...sign, shopName: event.target.value })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={accountId}>ชื่อบัญชีผู้รับเงิน</Label>
        <Input
          id={accountId}
          value={sign.accountName}
          maxLength={SIGN_ACCOUNT_NAME_MAX}
          placeholder="นางแดง ใจดี"
          onChange={(event) =>
            onChange({ ...sign, accountName: event.target.value })
          }
        />
        <p className="text-sm text-muted-foreground">
          พิมพ์ให้ตรงกับชื่อที่แอปธนาคารแสดงตอนโอนเข้าบัญชีนี้ เราไม่ได้ตรวจชื่อนี้กับธนาคาร
        </p>
      </div>

      {previewUrl !== null && (
        // biome-ignore lint/performance/noImgElement: blob URL ที่สร้างในเบราว์เซอร์ next/image ใช้ไม่ได้
        <img
          src={previewUrl}
          alt={`ตัวอย่างป้ายรับเงิน ${sign.shopName}`.trim()}
          className="mx-auto w-full max-w-60 rounded border shadow-sm"
        />
      )}

      <Button
        type="button"
        variant="outline"
        disabled={blob === null}
        onClick={() => {
          if (blob !== null) triggerDownload(blob, "promptpay-sign-a6.png");
        }}
        aria-label="ดาวน์โหลดป้ายรับเงินเป็นไฟล์ PNG ขนาด A6"
      >
        <Download aria-hidden />
        ดาวน์โหลดป้าย PNG (A6)
      </Button>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
