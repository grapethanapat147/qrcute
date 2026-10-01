"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { beginCheckout, type CheckoutActionState } from "./actions";

const INITIAL: CheckoutActionState = { status: "idle" };

export function CheckoutButton({
  plan,
  label,
  disabled,
}: {
  plan: string;
  label: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(beginCheckout, INITIAL);

  if (state.status === "promptpay") {
    return (
      <div className="space-y-3 text-center">
        {/* ภาพ QR มาจาก Opn ไม่ใช่จากเรา — ใช้ <img> ตรง ๆ เพราะเป็นโดเมนภายนอกที่เปลี่ยนได้ */}
        {/* biome-ignore lint/performance/noImgElement: ภาพจาก payment gateway ไม่ผ่าน next/image */}
        <img
          src={state.qrImageUrl}
          alt="QR พร้อมเพย์สำหรับชำระเงิน"
          className="mx-auto size-64 rounded-lg border bg-white p-3"
        />
        <p className="text-sm text-muted-foreground">
          สแกนด้วยแอปธนาคาร ระบบจะเปิดสิทธิ์ให้อัตโนมัติเมื่อเงินเข้า ไม่ต้องกดอะไรต่อ
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="plan" value={plan} />
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={disabled || pending}
      >
        {pending ? "กำลังเตรียมการชำระเงิน…" : label}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
