"use client";

import { CircleCheck, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveQr } from "@/app/actions/save-qr";
import { Button } from "@/components/ui/button";
import { addDraft, suggestTitle } from "@/lib/qr/draft";
import {
  canBeDynamic,
  DYNAMIC_LAPSE_NOTICE,
  DYNAMIC_UNSUPPORTED_REASON,
} from "@/lib/qr/dynamic-support";
import type { ErrorCorrectionLevel } from "@/lib/qr/encode";
import type { QrStyle } from "@/lib/qr/style";
import type { QrData } from "@/lib/qr/types";

export type QrSaveButtonProps = {
  data: QrData;
  style: QrStyle;
  level: ErrorCorrectionLevel;
  disabled: boolean;
};

type Saved = { id: string; shortcode: string | null };

export function QrSaveButton({
  data,
  style,
  level,
  disabled,
}: QrSaveButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dynamicPossible = canBeDynamic(data.type);

  function save(asDynamic: boolean) {
    setError(null);

    startTransition(async () => {
      const input = {
        title: suggestTitle(data),
        data,
        style,
        level,
        asDynamic,
      };
      const result = await saveQr(input);

      if (result.status === "needs-login") {
        // เก็บไว้ในเครื่องก่อน แล้วดึงเข้าบัญชีให้อัตโนมัติหลังล็อกอิน
        addDraft(window.localStorage, {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          ...input,
        });
        router.push("/login?next=/dashboard");
        return;
      }

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      setSaved({ id: result.id, shortcode: result.shortcode });
    });
  }

  if (saved !== null) {
    return (
      <div className="space-y-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <CircleCheck className="size-4" aria-hidden />
          บันทึกเข้าบัญชีแล้ว
        </p>

        {saved.shortcode !== null && (
          <p className="text-warning-foreground">
            <strong className="font-medium">QR เปลี่ยนไปแล้ว</strong> —
            ตอนนี้มันชี้มาที่ลิงก์ของเราเพื่อให้แก้ปลายทางได้ทีหลัง ต้องดาวน์โหลดไฟล์ใหม่จากหน้า QR
            ของฉัน อย่าใช้ไฟล์ที่โหลดไว้ก่อนหน้า
          </p>
        )}

        <Link
          href="/dashboard"
          className="inline-block underline underline-offset-4"
        >
          ไปที่ QR ของฉัน
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={disabled || pending}
        onClick={() => save(false)}
      >
        <Save aria-hidden />
        {pending ? "กำลังบันทึก…" : "บันทึกเข้าบัญชี"}
      </Button>

      {dynamicPossible ? (
        <>
          <Button
            type="button"
            className="w-full"
            disabled={disabled || pending}
            onClick={() => save(true)}
          >
            <RefreshCw aria-hidden />
            บันทึกแบบแก้ปลายทางได้
          </Button>
          {/*
            business invariant ข้อ 3 — ต้องบอกผลของการเลิกจ่ายก่อนกดสร้าง
            ไม่ใช่ตอนจะยกเลิก คนที่กำลังจะเอา QR ไปพิมพ์ลงป้ายไวนิลต้องรู้ตอนนี้
          */}
          <p className="text-sm text-muted-foreground">
            {DYNAMIC_LAPSE_NOTICE}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {DYNAMIC_UNSUPPORTED_REASON}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        บันทึกแล้วกลับมาแก้ดีไซน์และโหลดไฟล์ใหม่ได้ — โลโก้ยังบันทึกไม่ได้ ต้องใส่ใหม่ทุกครั้งที่โหลด
      </p>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
