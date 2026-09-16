import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * client ฝั่ง server สำหรับ Server Component และ Server Action
 *
 * อ่าน session จาก cookie ที่ proxy คอยต่ออายุให้ ไม่เคยแตะ service role key
 * ทุกคำสั่งจึงยังวิ่งผ่าน RLS เหมือนกับที่เบราว์เซอร์ทำ
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // เขียน cookie จาก Server Component ไม่ได้ — proxy จัดการต่ออายุให้อยู่แล้ว
          }
        },
      },
    },
  );
}
