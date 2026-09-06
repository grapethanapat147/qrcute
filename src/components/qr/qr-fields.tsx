"use client";

import { useId } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import {
  PROMPTPAY_TARGET_LABELS,
  PROMPTPAY_TARGET_TYPES,
  type PromptPayTargetType,
} from "@/lib/qr/promptpay";
import type { QrData } from "@/lib/qr/types";

const PROMPTPAY_TARGET_PLACEHOLDERS: Record<PromptPayTargetType, string> = {
  mobile: "081-234-5678",
  nationalId: "1-2345-67890-12-3",
  taxId: "0-1234-56789-01-2",
  ewallet: "012345678901234",
};

const PROMPTPAY_TARGET_HINTS: Record<PromptPayTargetType, string> = {
  mobile: "ต้องเป็นเบอร์ที่ผูกพร้อมเพย์ไว้กับบัญชีธนาคารแล้ว",
  nationalId: "ต้องเป็นเลขบัตรที่ผูกพร้อมเพย์ไว้แล้ว",
  taxId: "สำหรับร้านค้าและนิติบุคคลที่ลงทะเบียนพร้อมเพย์",
  ewallet: "รหัส 15 หลักของ e-Wallet ที่รองรับพร้อมเพย์",
};

type FieldProps = {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
};

function Field({ label, hint, children }: FieldProps) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint !== undefined && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export type QrFieldsProps = {
  data: QrData;
  onChange: (data: QrData) => void;
};

export function QrFields({ data, onChange }: QrFieldsProps) {
  switch (data.type) {
    case "promptpay":
      return (
        <div className="space-y-4">
          <Field label="รับเงินเข้าอะไร">
            {(id) => (
              <Select
                id={id}
                value={data.targetType}
                onChange={(event) =>
                  onChange({
                    ...data,
                    targetType: event.target.value as typeof data.targetType,
                    target: "",
                  })
                }
              >
                {PROMPTPAY_TARGET_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {PROMPTPAY_TARGET_LABELS[option]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label={PROMPTPAY_TARGET_LABELS[data.targetType]}
            hint={PROMPTPAY_TARGET_HINTS[data.targetType]}
          >
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="off"
                placeholder={PROMPTPAY_TARGET_PLACEHOLDERS[data.targetType]}
                value={data.target}
                onChange={(event) =>
                  onChange({ ...data, target: event.target.value })
                }
              />
            )}
          </Field>

          <Field
            label="จำนวนเงิน (บาท)"
            hint="เว้นว่างไว้ถ้าต้องการให้ผู้จ่ายกรอกจำนวนเงินเอง"
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="ไม่ระบุ"
                value={data.amount}
                onChange={(event) =>
                  onChange({ ...data, amount: event.target.value })
                }
              />
            )}
          </Field>
        </div>
      );

    case "url":
      return (
        <Field label="ลิงก์เว็บไซต์" hint="ไม่ต้องพิมพ์ https:// ก็ได้">
          {(id) => (
            <Input
              id={id}
              type="url"
              inputMode="url"
              placeholder="example.com/menu"
              value={data.url}
              onChange={(event) =>
                onChange({ ...data, url: event.target.value })
              }
            />
          )}
        </Field>
      );

    case "wifi":
      return (
        <div className="space-y-4">
          <Field label="ชื่อเครือข่าย (SSID)">
            {(id) => (
              <Input
                id={id}
                placeholder="ชื่อ WiFi ของร้าน"
                value={data.ssid}
                onChange={(event) =>
                  onChange({ ...data, ssid: event.target.value })
                }
              />
            )}
          </Field>

          <Field label="ประเภทการเข้ารหัส">
            {(id) => (
              <Select
                id={id}
                value={data.encryption}
                onChange={(event) =>
                  onChange({
                    ...data,
                    encryption: event.target.value as typeof data.encryption,
                  })
                }
              >
                <option value="WPA">WPA / WPA2 / WPA3 (ใช้กันทั่วไป)</option>
                <option value="WEP">WEP (เก่า)</option>
                <option value="nopass">ไม่มีรหัสผ่าน</option>
              </Select>
            )}
          </Field>

          {data.encryption !== "nopass" && (
            <Field label="รหัสผ่าน">
              {(id) => (
                <Input
                  id={id}
                  value={data.password}
                  onChange={(event) =>
                    onChange({ ...data, password: event.target.value })
                  }
                />
              )}
            </Field>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-primary"
              checked={data.hidden}
              onChange={(event) =>
                onChange({ ...data, hidden: event.target.checked })
              }
            />
            เครือข่ายนี้ซ่อนชื่อไว้
          </label>
        </div>
      );

    case "line":
      return (
        <Field
          label="LINE Official Account ID"
          hint="ใส่ ID ที่ขึ้นต้นด้วย @ เช่น @examplecafe (ดูได้ในหน้าตั้งค่า LINE OA)"
        >
          {(id) => (
            <Input
              id={id}
              placeholder="@examplecafe"
              value={data.officialAccountId}
              onChange={(event) =>
                onChange({ ...data, officialAccountId: event.target.value })
              }
            />
          )}
        </Field>
      );

    case "vcard":
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อ">
              {(id) => (
                <Input
                  id={id}
                  value={data.firstName}
                  onChange={(event) =>
                    onChange({ ...data, firstName: event.target.value })
                  }
                />
              )}
            </Field>
            <Field label="นามสกุล">
              {(id) => (
                <Input
                  id={id}
                  value={data.lastName}
                  onChange={(event) =>
                    onChange({ ...data, lastName: event.target.value })
                  }
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="บริษัท / ร้าน">
              {(id) => (
                <Input
                  id={id}
                  value={data.organization}
                  onChange={(event) =>
                    onChange({ ...data, organization: event.target.value })
                  }
                />
              )}
            </Field>
            <Field label="ตำแหน่ง">
              {(id) => (
                <Input
                  id={id}
                  value={data.title}
                  onChange={(event) =>
                    onChange({ ...data, title: event.target.value })
                  }
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="เบอร์โทร">
              {(id) => (
                <Input
                  id={id}
                  type="tel"
                  inputMode="tel"
                  placeholder="081-234-5678"
                  value={data.phone}
                  onChange={(event) =>
                    onChange({ ...data, phone: event.target.value })
                  }
                />
              )}
            </Field>
            <Field label="อีเมล">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  inputMode="email"
                  value={data.email}
                  onChange={(event) =>
                    onChange({ ...data, email: event.target.value })
                  }
                />
              )}
            </Field>
          </div>

          <Field label="เว็บไซต์">
            {(id) => (
              <Input
                id={id}
                value={data.website}
                onChange={(event) =>
                  onChange({ ...data, website: event.target.value })
                }
              />
            )}
          </Field>
        </div>
      );
  }
}
