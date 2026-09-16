"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

const OK: ActionResult = { ok: true, message: "" };

/**
 * ทุก action ในไฟล์นี้พึ่ง RLS เป็นชั้นตรวจสิทธิ์
 *
 * ไม่มีที่ไหนเช็ค owner_id เองในโค้ด เพราะ policy ใน migration ทำให้แล้ว
 * และการเช็คสองที่ทำให้เผลอแก้ที่เดียวแล้วอีกที่หลุด
 */

export async function renameQr(
  id: string,
  title: string,
): Promise<ActionResult> {
  const trimmed = title.trim().slice(0, 120);
  const supabase = await createClient();

  const { error } = await supabase
    .from("qr_codes")
    .update({ title: trimmed })
    .eq("id", id);

  if (error !== null) return { ok: false, message: "เปลี่ยนชื่อไม่สำเร็จ" };

  revalidatePath("/dashboard");
  return OK;
}

export async function updateTarget(
  id: string,
  target: string,
): Promise<ActionResult> {
  const trimmed = target.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: "ปลายทางต้องเป็นลิงก์เต็ม เช่น https://…" };
  }

  // กัน javascript: และ data: ที่เอาไปทำ phishing ต่อจากลิงก์ของเราได้
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "รองรับเฉพาะลิงก์ http และ https" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_qr_target", {
    qr_id: id,
    new_target: trimmed,
  });

  if (error !== null) return { ok: false, message: "แก้ปลายทางไม่สำเร็จ" };

  revalidatePath("/dashboard");
  return OK;
}

/**
 * เก็บ QR เข้าคลังหรือเอากลับมาใช้
 *
 * ต้องผ่าน function เพราะ authenticated ไม่มีสิทธิ์ update คอลัมน์ status ตรง ๆ
 * ไม่งั้นคนที่ถูกพักเพราะเลิกจ่ายจะยิง update กลับเป็น active เองได้จากเบราว์เซอร์
 * (ดู docs/decisions/0008-downgrade-behaviour.md)
 */
export async function setQrStatus(
  id: string,
  status: "active" | "archived",
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_qr_status", {
    qr_id: id,
    new_status: status,
  });

  if (error !== null) return { ok: false, message: "เปลี่ยนสถานะไม่สำเร็จ" };

  revalidatePath("/dashboard");
  return OK;
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
