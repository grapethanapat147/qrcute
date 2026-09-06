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
import { svgToDataUri } from "@/lib/qr/render-png";
import { renderSvg } from "@/lib/qr/render-svg";
import { DEFAULT_QR_STYLE, type QrStyle, validateStyle } from "@/lib/qr/style";
import {
  emptyQrData,
  isQrDataComplete,
  QR_TYPE_DESCRIPTIONS,
  QR_TYPE_LABELS,
  QR_TYPES,
  type QrData,
  validateQrData,
} from "@/lib/qr/types";
import {
  errorCorrectionFromSearchParams,
  qrDataFromSearchParams,
  qrDataToSearchParams,
  qrStyleFromSearchParams,
  qrStyleToSearchParams,
} from "@/lib/qr/url-state";
import { cn } from "@/lib/utils";
import { PromptPaySummary } from "./promptpay-summary";
import { QrDownload } from "./qr-download";
import { QrFields } from "./qr-fields";
import { QrPreview } from "./qr-preview";
import { QrStyleControls } from "./qr-style-controls";
import { useDebouncedValue } from "./use-debounced-value";

type EncodeResult =
  | { matrix: QrMatrix; svg: string }
  | { error: string }
  | null;

type PanelId = "data" | "design";

const PANELS: Array<{ id: PanelId; label: string }> = [
  { id: "data", label: "ข้อมูล" },
  { id: "design", label: "ดีไซน์" },
];

function buildPreview(
  data: QrData,
  level: ErrorCorrectionLevel,
  style: QrStyle,
): EncodeResult {
  if (!isQrDataComplete(data)) return null;

  // พร้อมเพย์ที่ validate ไม่ผ่านต้องไม่แสดง QR เลย ไม่ใช่แสดงแล้วค่อยเตือน
  const dataError = validateQrData(data);
  if (dataError !== null) return { error: dataError };

  const styleValidation = validateStyle(style);
  if (styleValidation.error !== null) return { error: styleValidation.error };

  try {
    const matrix = encodeQr(buildPayload(data), level, style.margin);
    return { matrix, svg: renderSvg(matrix, { style }) };
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

  const [panel, setPanel] = useState<PanelId>("data");
  const [data, setData] = useState<QrData>(
    () => qrDataFromSearchParams(searchParams) ?? emptyQrData("promptpay"),
  );
  const [level, setLevel] = useState<ErrorCorrectionLevel>(() =>
    errorCorrectionFromSearchParams(searchParams),
  );
  const [style, setStyle] = useState<QrStyle>(() =>
    qrStyleFromSearchParams(searchParams),
  );

  const debouncedData = useDebouncedValue(data);
  const debouncedLevel = useDebouncedValue(level);
  const debouncedStyle = useDebouncedValue(style);

  const result = useMemo(
    () => buildPreview(debouncedData, debouncedLevel, debouncedStyle),
    [debouncedData, debouncedLevel, debouncedStyle],
  );

  const styleWarning = useMemo(
    () => validateStyle(debouncedStyle).warning,
    [debouncedStyle],
  );

  // เก็บสถานะไว้ใน URL เพื่อให้แชร์และบุ๊กมาร์กได้
  // ใช้ replaceState แทน push เพื่อไม่ให้ปุ่ม back ต้องกดย้อนทีละตัวอักษร
  useEffect(() => {
    const params = qrDataToSearchParams(debouncedData, debouncedLevel);
    qrStyleToSearchParams(debouncedStyle, params);
    const query = params.toString();
    window.history.replaceState(null, "", query === "" ? "/" : `?${query}`);
  }, [debouncedData, debouncedLevel, debouncedStyle]);

  const matrix = result !== null && "matrix" in result ? result.matrix : null;
  const svg = result !== null && "svg" in result ? result.svg : null;
  const error = result !== null && "error" in result ? result.error : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-6">
        <div
          role="tablist"
          aria-label="ส่วนควบคุม"
          className="flex gap-1 border-b"
        >
          {PANELS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={panel === item.id}
              aria-controls={`panel-${item.id}`}
              onClick={() => setPanel(item.id)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                panel === item.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          id="panel-data"
          role="tabpanel"
          hidden={panel !== "data"}
          className="space-y-6"
        >
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
                    onChange={() => setData(emptyQrData(type))}
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

        <div id="panel-design" role="tabpanel" hidden={panel !== "design"}>
          <QrStyleControls style={style} onChange={setStyle} />
          <button
            type="button"
            onClick={() => setStyle(DEFAULT_QR_STYLE)}
            className="mt-6 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            คืนค่าเริ่มต้น
          </button>
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
        <QrPreview
          src={svg === null ? null : svgToDataUri(svg)}
          error={error}
          warning={error === null ? styleWarning : null}
          description={`QR Code ประเภท${QR_TYPE_LABELS[data.type]}`}
        />
        {debouncedData.type === "promptpay" && matrix !== null && (
          <PromptPaySummary
            targetType={debouncedData.targetType}
            target={debouncedData.target}
            amount={debouncedData.amount}
          />
        )}
        <QrDownload
          matrix={matrix}
          style={debouncedStyle}
          filenameBase={`qr-${data.type}`}
        />
      </div>
    </div>
  );
}
