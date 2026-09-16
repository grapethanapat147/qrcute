import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * แลกรหัสจากลิงก์ในอีเมลเป็น session
 *
 * ยอมรับเฉพาะปลายทางที่เป็น path ภายในเว็บเรา — ถ้าปล่อยให้ระบุ URL เต็มได้
 * จะกลายเป็น open redirect ที่เอาไปใช้ทำ phishing ต่อจากลิงก์ที่ดูน่าเชื่อถือของเรา
 */
function safeNextPath(raw: string | null): string {
  if (raw === null || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code === null) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_code", request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
