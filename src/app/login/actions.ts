"use server";

import { absoluteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message: string;
};

/**
 * ส่งลิงก์เข้าสู่ระบบทางอีเมล
 *
 * เลือกวิธีลิงก์แทนรหัสผ่าน เพราะ ICP ของเราคือเจ้าของร้านที่เข้าระบบนาน ๆ ครั้ง
 * รหัสผ่านที่ตั้งแล้วลืมกลายเป็นงาน support และเป็นช่องให้ใช้รหัสซ้ำกับที่อื่น
 */
export async function sendLoginLink(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "กรุณากรอกอีเมลให้ถูกต้อง" };
  }

  const nextPath = String(formData.get("next") ?? "/dashboard");
  // ใช้โดเมนจาก siteConfig ไม่ใช่ header origin — header ไม่รับประกันว่าจะมีเสมอ
  // และ ADR 0002 กำหนดให้โดเมนมาจากที่เดียวคือ src/lib/site.ts

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: absoluteUrl(
        `/auth/callback?next=${encodeURIComponent(nextPath)}`,
      ),
    },
  });

  if (error !== null) {
    return {
      status: "error",
      message: "ส่งลิงก์ไม่สำเร็จ ลองใหม่อีกครั้งในสักครู่",
    };
  }

  return {
    status: "sent",
    message: `ส่งลิงก์เข้าสู่ระบบไปที่ ${email} แล้ว — เปิดอีเมลแล้วกดลิงก์ได้เลย`,
  };
}
