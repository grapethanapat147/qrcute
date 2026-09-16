"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * client ฝั่งเบราว์เซอร์ — ใช้ anon key ซึ่งเปิดเผยได้
 * สิ่งที่ทำได้ถูกจำกัดด้วย RLS ใน supabase/migrations เท่านั้น
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}
