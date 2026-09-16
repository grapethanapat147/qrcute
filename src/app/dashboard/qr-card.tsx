"use client";

import { Archive, ArchiveRestore, Check, History, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QR_TYPE_LABELS, type QrType } from "@/lib/qr/types";
import { cn } from "@/lib/utils";
import { renameQr, setQrStatus, updateTarget } from "./actions";

export type QrVersion = {
  version: number;
  target_url: string;
  created_at: string;
};

export type QrCardData = {
  id: string;
  title: string;
  kind: "static" | "dynamic";
  qr_type: string;
  shortcode: string | null;
  current_target: string | null;
  status: string;
  created_at: string;
  versions: QrVersion[];
};

const DATE_FORMAT = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function QrCard({ qr, origin }: { qr: QrCardData; origin: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<"none" | "title" | "target">("none");
  const [showHistory, setShowHistory] = useState(false);
  const [title, setTitle] = useState(qr.title);
  const [target, setTarget] = useState(qr.current_target ?? "");

  const archived = qr.status === "archived";

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : result.message);
      if (result.ok) setEditing("none");
    });
  }

  return (
    <article
      className={cn(
        "space-y-3 rounded-lg border p-4",
        archived && "bg-muted/40 opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          {editing === "title" ? (
            <div className="flex gap-2">
              <Input
                value={title}
                autoFocus
                aria-label="ชื่อ QR"
                onChange={(event) => setTitle(event.target.value)}
              />
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => renameQr(qr.id, title))}
              >
                <Check aria-hidden />
                บันทึก
              </Button>
            </div>
          ) : (
            <h2 className="flex items-center gap-2 font-medium">
              {qr.title === "" ? "ไม่มีชื่อ" : qr.title}
              <button
                type="button"
                aria-label="เปลี่ยนชื่อ"
                onClick={() => setEditing("title")}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
            </h2>
          )}

          <p className="text-sm text-muted-foreground">
            {QR_TYPE_LABELS[qr.qr_type as QrType] ?? qr.qr_type}
            {" · "}
            {qr.kind === "dynamic" ? "แก้ปลายทางได้" : "ชี้ปลายทางตรง"}
            {archived && " · เก็บเข้าคลังแล้ว"}
          </p>
        </div>

        <div className="flex gap-1">
          {qr.kind === "dynamic" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((value) => !value)}
              aria-expanded={showHistory}
            >
              <History aria-hidden />
              ประวัติ ({qr.versions.length})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => setQrStatus(qr.id, archived ? "active" : "archived"))
            }
          >
            {archived ? (
              <ArchiveRestore aria-hidden />
            ) : (
              <Archive aria-hidden />
            )}
            {archived ? "กู้คืน" : "เก็บเข้าคลัง"}
          </Button>
        </div>
      </div>

      {qr.kind === "dynamic" && qr.shortcode !== null && (
        <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-mono break-all">
            {origin}/r/{qr.shortcode}
          </p>
          <p className="text-xs text-muted-foreground">
            ลิงก์นี้อยู่ใน QR ที่พิมพ์ไปแล้ว — เปลี่ยนปลายทางด้านล่างได้โดยไม่ต้องพิมพ์ใหม่
          </p>

          {editing === "target" ? (
            <div className="flex flex-wrap gap-2">
              <Input
                value={target}
                autoFocus
                inputMode="url"
                aria-label="ปลายทางใหม่"
                onChange={(event) => setTarget(event.target.value)}
                className="min-w-48 flex-1"
              />
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => updateTarget(qr.id, target))}
              >
                <Check aria-hidden />
                เปลี่ยนปลายทาง
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all">→ {qr.current_target}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing("target")}
              >
                <Pencil aria-hidden />
                แก้ปลายทาง
              </Button>
            </div>
          )}
        </div>
      )}

      {showHistory && (
        <ol className="space-y-1 border-l pl-4 text-sm">
          {qr.versions.length === 0 && (
            <li className="text-muted-foreground">ยังไม่เคยแก้ปลายทาง</li>
          )}
          {qr.versions.map((version) => (
            <li key={version.version} className="text-muted-foreground">
              <span className="font-medium text-foreground">
                v{version.version}
              </span>{" "}
              {DATE_FORMAT.format(new Date(version.created_at))} —{" "}
              <span className="break-all">{version.target_url}</span>
            </li>
          ))}
        </ol>
      )}

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </article>
  );
}
