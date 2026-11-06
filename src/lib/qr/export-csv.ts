import { buildPayload } from "./payload";
import { QR_TYPE_LABELS, type QrData, type QrType } from "./types";

/**
 * ส่งออก QR ทั้งหมดในบัญชีเป็น CSV — ให้ลูกค้าย้ายออกได้เองทุกเมื่อ
 *
 * คำบ่นซ้ำ ๆ ของตลาดคือย้ายเจ้าไม่ได้และติดต่อใครไม่ได้ ไฟล์นี้ต้องมีพอให้สร้าง QR ใหม่
 * ที่ไหนก็ได้โดยไม่ต้องพึ่งเรา: ข้อมูลจริงในตัว QR และปลายทางปัจจุบันของ QR แบบแก้ได้
 */

export type ExportableQr = {
  title: string;
  kind: string;
  qr_type: string;
  content: unknown;
  shortcode: string | null;
  current_target: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  active: "ใช้งานอยู่",
  archived: "เก็บเข้าคลัง",
  suspended: "ถูกพัก",
  disabled: "หยุดทำงาน",
};

const HEADER = [
  "ชื่อ",
  "ประเภท",
  "แบบ",
  "ข้อมูลที่อยู่ในตัว QR",
  "ปลายทางปัจจุบัน",
  "สถานะ",
  "สร้างเมื่อ",
];

/**
 * กัน CSV formula injection — เซลล์ที่ขึ้นต้นด้วย = + - @ จะถูก Excel รันเป็นสูตร
 * ชื่อ QR เป็นข้อความที่ผู้ใช้พิมพ์เอง จึงใส่ ' นำหน้าให้กลายเป็นข้อความธรรมดา
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: string[][]): string {
  // BOM ให้ Excel อ่านภาษาไทยเป็น UTF-8 ไม่งั้นชื่อไทยกลายเป็นตัวอักษรเพี้ยน
  return `﻿${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

function payloadOf(content: unknown): string {
  try {
    return buildPayload(content as QrData);
  } catch {
    return "";
  }
}

export function qrExportCsv(codes: ExportableQr[], origin: string): string {
  const rows = codes.map((qr) => {
    const dynamic = qr.kind === "dynamic";
    return [
      qr.title,
      QR_TYPE_LABELS[qr.qr_type as QrType] ?? qr.qr_type,
      dynamic ? "แก้ปลายทางได้" : "ฝังข้อมูลตรง",
      dynamic && qr.shortcode !== null
        ? new URL(`/r/${qr.shortcode}`, origin).toString()
        : payloadOf(qr.content),
      dynamic ? (qr.current_target ?? "") : "",
      STATUS_LABELS[qr.status] ?? qr.status,
      qr.created_at.slice(0, 10),
    ];
  });
  return toCsv([HEADER, ...rows]);
}
