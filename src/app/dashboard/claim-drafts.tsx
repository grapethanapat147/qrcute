"use client";

import { Import } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { claimDrafts } from "@/app/actions/save-qr";
import { Button } from "@/components/ui/button";
import { clearDrafts, type QrDraft, readDrafts } from "@/lib/qr/draft";

/**
 * ดึง QR ที่ผู้ใช้สร้างไว้ตอนยังไม่ล็อกอินเข้าบัญชี
 *
 * ไม่ดึงอัตโนมัติ — ให้ผู้ใช้กดยืนยันเอง เพราะอาจเป็นเครื่องที่ใช้ร่วมกัน
 * และ QR ที่ค้างอยู่อาจเป็นของคนก่อนหน้า
 */
export function ClaimDrafts() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<QrDraft[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // อ่านหลัง mount เท่านั้น เพราะ localStorage ไม่มีบน server
  useEffect(() => {
    setDrafts(readDrafts(window.localStorage));
  }, []);

  if (drafts.length === 0) {
    return message === null ? null : (
      <output className="mb-4 block rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
        {message}
      </output>
    );
  }

  function claim() {
    startTransition(async () => {
      const result = await claimDrafts(
        drafts.map((draft) => ({
          title: draft.title,
          data: draft.data,
          style: draft.style,
          level: draft.level,
          asDynamic: false,
        })),
      );

      clearDrafts(window.localStorage);
      setDrafts([]);
      setMessage(
        result.failed === 0
          ? `ดึง QR เข้าบัญชีแล้ว ${result.saved} อัน`
          : `ดึงเข้าบัญชีได้ ${result.saved} อัน ไม่สำเร็จ ${result.failed} อัน`,
      );
      router.refresh();
    });
  }

  return (
    <section className="mb-6 space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div>
        <h2 className="font-medium">
          มี QR ที่สร้างไว้ก่อนเข้าสู่ระบบ {drafts.length} อัน
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          เก็บอยู่ในเครื่องนี้เท่านั้น ยังไม่ได้ส่งขึ้นระบบ — กดดึงเข้าบัญชีเพื่อกลับมาแก้ทีหลังได้
        </p>
      </div>

      <ul className="space-y-1 text-sm">
        {drafts.map((draft) => (
          <li key={draft.id} className="text-muted-foreground">
            • {draft.title === "" ? "ไม่มีชื่อ" : draft.title}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={claim}>
          <Import aria-hidden />
          {pending ? "กำลังดึง…" : "ดึงเข้าบัญชี"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            clearDrafts(window.localStorage);
            setDrafts([]);
          }}
        >
          ไม่ใช่ของฉัน ลบทิ้ง
        </Button>
      </div>
    </section>
  );
}
