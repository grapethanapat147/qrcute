"use client";

import { useId } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import {
  CTA_MAX_LENGTH,
  CTA_PRESETS,
  FRAME_KIND_DESCRIPTIONS,
  FRAME_KIND_LABELS,
  FRAME_KINDS,
  type QrFrame,
} from "@/lib/qr/frame";
import { cn } from "@/lib/utils";

export type QrFrameFieldProps = {
  frame: QrFrame;
  onChange: (frame: QrFrame) => void;
};

export function QrFrameField({ frame, onChange }: QrFrameFieldProps) {
  const kindId = useId();
  const textId = useId();
  const textColorId = useId();
  const backgroundId = useId();
  const presetsId = useId();

  const showText = frame.kind !== "none";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={kindId}>กรอบและข้อความชวนสแกน</Label>
        <Select
          id={kindId}
          value={frame.kind}
          onChange={(event) =>
            onChange({ ...frame, kind: event.target.value as QrFrame["kind"] })
          }
        >
          {FRAME_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {FRAME_KIND_LABELS[kind]}
            </option>
          ))}
        </Select>
        <p className="text-sm text-muted-foreground">
          {FRAME_KIND_DESCRIPTIONS[frame.kind]}
        </p>
      </div>

      {showText && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={textId}>ข้อความ</Label>
            <Input
              id={textId}
              value={frame.text}
              maxLength={CTA_MAX_LENGTH}
              onChange={(event) =>
                onChange({ ...frame, text: event.target.value })
              }
            />
            <fieldset className="flex flex-wrap gap-1.5 pt-1">
              <legend id={presetsId} className="sr-only">
                ข้อความที่ใช้บ่อย
              </legend>
              {CTA_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange({ ...frame, text: preset })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    frame.text === preset
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-secondary",
                  )}
                >
                  {preset}
                </button>
              ))}
            </fieldset>
            <p className="text-sm text-muted-foreground">
              ข้อความยาวจะถูกย่อและตัดเป็นสองบรรทัดให้อัตโนมัติ โดยตัดที่ช่องว่างเท่านั้น
              ไม่ตัดกลางคำไทย
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={backgroundId}>สีแถบ</Label>
              <div className="flex gap-2">
                <input
                  id={backgroundId}
                  type="color"
                  value={frame.background}
                  onChange={(event) =>
                    onChange({ ...frame, background: event.target.value })
                  }
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                />
                <Input
                  value={frame.background}
                  onChange={(event) =>
                    onChange({ ...frame, background: event.target.value })
                  }
                  aria-label="สีแถบเป็นรหัสสี"
                  className="font-mono uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={textColorId}>สีข้อความ</Label>
              <div className="flex gap-2">
                <input
                  id={textColorId}
                  type="color"
                  value={frame.textColor}
                  onChange={(event) =>
                    onChange({ ...frame, textColor: event.target.value })
                  }
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                />
                <Input
                  value={frame.textColor}
                  onChange={(event) =>
                    onChange({ ...frame, textColor: event.target.value })
                  }
                  aria-label="สีข้อความเป็นรหัสสี"
                  className="font-mono uppercase"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
