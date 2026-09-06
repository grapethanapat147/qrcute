"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { Label, Select } from "@/components/ui/input";
import {
  ERROR_CORRECTION_INFO,
  ERROR_CORRECTION_LEVELS,
  type ErrorCorrectionLevel,
  encodeQr,
  type QrMatrix,
} from "@/lib/qr/encode";
import { buildPayload } from "@/lib/qr/payload";
import {
  emptyQrData,
  isQrDataComplete,
  QR_TYPE_DESCRIPTIONS,
  QR_TYPE_LABELS,
  QR_TYPES,
  type QrData,
  type QrType,
} from "@/lib/qr/types";
import {
  errorCorrectionFromSearchParams,
  qrDataFromSearchParams,
  qrDataToSearchParams,
} from "@/lib/qr/url-state";
import { cn } from "@/lib/utils";
import { QrDownload } from "./qr-download";
import { QrFields } from "./qr-fields";
import { QrPreview } from "./qr-preview";
import { useDebouncedValue } from "./use-debounced-value";

type EncodeResult = { matrix: QrMatrix } | { error: string };

function encodePreview(
  data: QrData,
  level: ErrorCorrectionLevel,
): EncodeResult {
  try {
    return { matrix: encodeQr(buildPayload(data), level) };
  } catch (cause) {
    return {
      error:
        cause instanceof Error
          ? cause.message
          : "สร้าง QR ไม่สำเร็จ ลองลดความยาวข้อมูลลง",
    };
  }
}

export function QrGenerator() {
  const searchParams = useSearchParams();
  const typeGroupId = useId();
  const eccId = useId();

  const [data, setData] = useState<QrData>(
    () => qrDataFromSearchParams(searchParams) ?? emptyQrData("url"),
  );
  const [level, setLevel] = useState<ErrorCorrectionLevel>(() =>
    errorCorrectionFromSearchParams(searchParams),
  );

  const debouncedData = useDebouncedValue(data);
  const debouncedLevel = useDebouncedValue(level);

  const result = useMemo<EncodeResult | null>(() => {
    if (!isQrDataComplete(debouncedData)) return null;
    return encodePreview(debouncedData, debouncedLevel);
  }, [debouncedData, debouncedLevel]);

  // เก็บสถานะไว้ใน URL เพื่อให้แชร์และบุ๊กมาร์กได้
  // ใช้ replaceState แทน push เพื่อไม่ให้ปุ่ม back ต้องกดย้อนทีละตัวอักษร
  useEffect(() => {
    const params = qrDataToSearchParams(debouncedData, debouncedLevel);
    const query = params.toString();
    window.history.replaceState(null, "", query === "" ? "/" : `?${query}`);
  }, [debouncedData, debouncedLevel]);

  function changeType(nextType: QrType) {
    setData(emptyQrData(nextType));
  }

  const matrix = result !== null && "matrix" in result ? result.matrix : null;
  const error = result !== null && "error" in result ? result.error : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-3 text-sm font-medium" id={typeGroupId}>
            เลือกประเภท QR
          </legend>
          <div
            role="radiogroup"
            aria-labelledby={typeGroupId}
            className="flex flex-wrap gap-2"
          >
            {QR_TYPES.map((type) => (
              <label
                key={type}
                className={cn(
                  "cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                  data.type === type
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:bg-secondary",
                )}
              >
                <input
                  type="radio"
                  name="qr-type"
                  value={type}
                  checked={data.type === type}
                  onChange={() => changeType(type)}
                  className="sr-only"
                />
                {QR_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {QR_TYPE_DESCRIPTIONS[data.type]}
          </p>
        </fieldset>

        <QrFields data={data} onChange={setData} />

        <div className="space-y-1.5">
          <Label htmlFor={eccId}>ระดับการกู้คืนข้อมูล</Label>
          <Select
            id={eccId}
            value={level}
            onChange={(event) =>
              setLevel(event.target.value as ErrorCorrectionLevel)
            }
          >
            {ERROR_CORRECTION_LEVELS.map((option) => (
              <option key={option} value={option}>
                {ERROR_CORRECTION_INFO[option].label} — กู้คืนได้{" "}
                {ERROR_CORRECTION_INFO[option].recovery}%
              </option>
            ))}
          </Select>
          <p className="text-sm text-muted-foreground">
            {ERROR_CORRECTION_INFO[level].description}
          </p>
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
        <QrPreview
          matrix={matrix}
          error={error}
          description={`QR Code ประเภท${QR_TYPE_LABELS[data.type]}`}
        />
        <QrDownload matrix={matrix} filenameBase={`qr-${data.type}`} />
      </div>
    </div>
  );
}
