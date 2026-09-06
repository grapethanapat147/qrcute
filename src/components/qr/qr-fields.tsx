"use client";

import { useId } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { QrData } from "@/lib/qr/types";

type FieldProps = {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
};

function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint !== undefined && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
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

    case "text":
      return (
        <Field label="ข้อความ" hint="ข้อความยาวจะทำให้ QR ซับซ้อนและสแกนยากขึ้น">
          {(id) => (
            <Textarea
              id={id}
              placeholder="ข้อความที่ต้องการให้แสดงเมื่อสแกน"
              value={data.text}
              onChange={(event) =>
                onChange({ ...data, text: event.target.value })
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

    case "tel":
      return (
        <Field label="เบอร์โทร" hint="สแกนแล้วจะขึ้นหน้าโทรออกพร้อมเบอร์นี้">
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
      );

    case "sms":
      return (
        <div className="space-y-4">
          <Field label="เบอร์ปลายทาง">
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
          <Field label="ข้อความตั้งต้น" hint="ผู้สแกนแก้ข้อความได้ก่อนส่ง">
            {(id) => (
              <Textarea
                id={id}
                value={data.message}
                onChange={(event) =>
                  onChange({ ...data, message: event.target.value })
                }
              />
            )}
          </Field>
        </div>
      );

    case "email":
      return (
        <div className="space-y-4">
          <Field label="อีเมลปลายทาง">
            {(id) => (
              <Input
                id={id}
                type="email"
                inputMode="email"
                placeholder="hello@example.com"
                value={data.to}
                onChange={(event) =>
                  onChange({ ...data, to: event.target.value })
                }
              />
            )}
          </Field>
          <Field label="หัวข้อ">
            {(id) => (
              <Input
                id={id}
                value={data.subject}
                onChange={(event) =>
                  onChange({ ...data, subject: event.target.value })
                }
              />
            )}
          </Field>
          <Field label="เนื้อหาตั้งต้น">
            {(id) => (
              <Textarea
                id={id}
                value={data.body}
                onChange={(event) =>
                  onChange({ ...data, body: event.target.value })
                }
              />
            )}
          </Field>
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
  }
}
