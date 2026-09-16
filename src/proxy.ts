import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * ต่ออายุ session ให้ทุกคำขอที่เข้าหน้าเว็บ
 *
 * ⚠️ ห้ามใส่ /r/ ใน matcher เด็ดขาด — เส้นทางสแกน QR ต้องเร็วที่สุด
 * และไม่เกี่ยวกับ session ของใครทั้งนั้น
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // ต้องเรียก getUser ที่นี่ ไม่ใช่ getSession — getUser ตรวจ token กับเซิร์ฟเวอร์จริง
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null && request.nextUrl.pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
