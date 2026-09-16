"use client";

import { Mail } from "lucide-react";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { type LoginState, sendLoginLink } from "./actions";

const INITIAL: LoginState = { status: "idle", message: "" };

export function LoginForm({ next }: { next: string }) {
  const emailId = useId();
  const [state, action, pending] = useActionState(sendLoginLink, INITIAL);

  if (state.status === "sent") {
    return (
      <output className="block rounded-lg border border-success/40 bg-success/10 p-4 text-sm">
        {state.message}
      </output>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <Label htmlFor={emailId}>อีเมล</Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        <Mail aria-hidden />
        {pending ? "กำลังส่ง…" : "ส่งลิงก์เข้าสู่ระบบ"}
      </Button>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        ไม่ต้องตั้งรหัสผ่าน เรากดส่งลิงก์ไปที่อีเมล กดลิงก์แล้วเข้าใช้งานได้เลย
      </p>
    </form>
  );
}
