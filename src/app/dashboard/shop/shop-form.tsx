"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { MAX_LINKS, type ShopLink, type ShopPageInput } from "@/lib/shop/page";
import { type ShopActionState, saveShop } from "./actions";

const INITIAL: ShopActionState = { status: "idle", message: "" };

// shortcut: แสดงช่องลิงก์ 5 ช่องตายตัว ไม่มีปุ่มเพิ่ม/ลบ, ทำแบบเพิ่มได้ถ้าร้านต้องการเกิน 5 ลิงก์บ่อย
const VISIBLE_LINKS = 5;

export function ShopForm({ initial }: { initial: ShopPageInput | null }) {
  const [state, action, pending] = useActionState(saveShop, INITIAL);
  const current = state.values ?? initial;
  const links: ShopLink[] =
    current?.links.filter((l) => l.label || l.url) ?? [];
  const rows = Math.min(MAX_LINKS, Math.max(VISIBLE_LINKS, links.length));

  return (
    <form key={JSON.stringify(current)} action={action} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">ชื่อร้าน</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          defaultValue={current?.name}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">แนะนำร้านสั้น ๆ</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={300}
          defaultValue={current?.description}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">เบอร์โทร</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={current?.phone}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hours">เวลาเปิดปิด</Label>
          <Input
            id="hours"
            name="hours"
            maxLength={120}
            placeholder="ทุกวัน 08:00–17:00"
            defaultValue={current?.hours}
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">ปุ่มลิงก์</legend>
        <p className="text-sm text-muted-foreground">
          เช่น เมนู, LINE, Facebook, แผนที่ Google Maps — เว้นว่างแถวที่ไม่ใช้
        </p>
        {Array.from({ length: rows }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: แถวคงที่ ไม่มีการสลับลำดับ
          <div key={i} className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <Input
              name={`label${i}`}
              aria-label={`ชื่อปุ่มที่ ${i + 1}`}
              placeholder="ชื่อปุ่ม"
              maxLength={40}
              defaultValue={links[i]?.label}
            />
            <Input
              name={`url${i}`}
              aria-label={`ลิงก์ของปุ่มที่ ${i + 1}`}
              placeholder="https://…"
              inputMode="url"
              defaultValue={links[i]?.url}
            />
          </div>
        ))}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึกหน้าร้าน"}
        </Button>
        {state.status !== "idle" && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={
              state.status === "error"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
