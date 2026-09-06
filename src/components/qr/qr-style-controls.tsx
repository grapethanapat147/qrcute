"use client";

import { useId } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import type { ErrorCorrectionLevel } from "@/lib/qr/encode";
import {
  DOT_SHAPE_LABELS,
  DOT_SHAPES,
  EYE_SHAPE_LABELS,
  EYE_SHAPES,
  GRADIENT_DIRECTION_LABELS,
  GRADIENT_DIRECTIONS,
  MARGIN_OPTIONS,
  nearestMarginOption,
  QR_STYLE_PRESETS,
  type QrStyle,
} from "@/lib/qr/style";
import { cn } from "@/lib/utils";
import { QrLogoField } from "./qr-logo-field";

type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function ColorField({ label, value, onChange }: ColorFieldProps) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label={`${label} เป็นรหัสสี`}
          className="font-mono uppercase"
        />
      </div>
    </div>
  );
}

export type QrStyleControlsProps = {
  style: QrStyle;
  level: ErrorCorrectionLevel;
  onChange: (style: QrStyle) => void;
};

export function QrStyleControls({
  style,
  level,
  onChange,
}: QrStyleControlsProps) {
  const dotShapeId = useId();
  const eyeFrameId = useId();
  const eyeBallId = useId();
  const gradientId = useId();
  const marginId = useId();
  const presetGroupId = useId();

  const activeMargin = nearestMarginOption(style.margin);
  const activePreset = QR_STYLE_PRESETS.find(
    (preset) => JSON.stringify(preset.style) === JSON.stringify(style),
  );

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-medium" id={presetGroupId}>
          รูปแบบสำเร็จรูป
        </legend>
        <div
          role="radiogroup"
          aria-labelledby={presetGroupId}
          className="flex flex-wrap gap-2"
        >
          {QR_STYLE_PRESETS.map((preset) => (
            <label
              key={preset.id}
              title={preset.description}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                activePreset?.id === preset.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-secondary",
              )}
            >
              <input
                type="radio"
                name="qr-style-preset"
                value={preset.id}
                checked={activePreset?.id === preset.id}
                onChange={() => onChange(preset.style)}
                className="sr-only"
              />
              {preset.label}
            </label>
          ))}
        </div>
        {activePreset !== undefined && (
          <p className="mt-2 text-sm text-muted-foreground">
            {activePreset.description}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          label="สีจุด"
          value={style.ink}
          onChange={(ink) => onChange({ ...style, ink })}
        />
        <ColorField
          label="สีพื้นหลัง"
          value={style.paper}
          onChange={(paper) => onChange({ ...style, paper })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={gradientId}>ไล่เฉดสี</Label>
        <Select
          id={gradientId}
          value={style.gradientDirection}
          onChange={(event) =>
            onChange({
              ...style,
              gradientDirection: event.target
                .value as typeof style.gradientDirection,
            })
          }
        >
          {GRADIENT_DIRECTIONS.map((direction) => (
            <option key={direction} value={direction}>
              {GRADIENT_DIRECTION_LABELS[direction]}
            </option>
          ))}
        </Select>
      </div>

      {style.gradientDirection !== "none" && (
        <ColorField
          label="สีปลายทางของเฉด"
          value={style.inkSecondary}
          onChange={(inkSecondary) => onChange({ ...style, inkSecondary })}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={dotShapeId}>รูปทรงจุด</Label>
          <Select
            id={dotShapeId}
            value={style.dotShape}
            onChange={(event) =>
              onChange({
                ...style,
                dotShape: event.target.value as typeof style.dotShape,
              })
            }
          >
            {DOT_SHAPES.map((shape) => (
              <option key={shape} value={shape}>
                {DOT_SHAPE_LABELS[shape]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={eyeFrameId}>กรอบตามุม</Label>
          <Select
            id={eyeFrameId}
            value={style.eyeFrameShape}
            onChange={(event) =>
              onChange({
                ...style,
                eyeFrameShape: event.target.value as typeof style.eyeFrameShape,
              })
            }
          >
            {EYE_SHAPES.map((shape) => (
              <option key={shape} value={shape}>
                {EYE_SHAPE_LABELS[shape]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={eyeBallId}>จุดกลางตามุม</Label>
          <Select
            id={eyeBallId}
            value={style.eyeBallShape}
            onChange={(event) =>
              onChange({
                ...style,
                eyeBallShape: event.target.value as typeof style.eyeBallShape,
              })
            }
          >
            {EYE_SHAPES.map((shape) => (
              <option key={shape} value={shape}>
                {EYE_SHAPE_LABELS[shape]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <QrLogoField
        logo={style.logo}
        level={level}
        onChange={(logo) => onChange({ ...style, logo })}
      />

      <div className="space-y-1.5">
        <Label htmlFor={marginId}>พื้นที่ว่างรอบ QR</Label>
        <Select
          id={marginId}
          value={String(activeMargin.value)}
          onChange={(event) =>
            onChange({ ...style, margin: Number(event.target.value) })
          }
        >
          {MARGIN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <p className="text-sm text-muted-foreground">
          {activeMargin.description}
        </p>
      </div>
    </div>
  );
}
