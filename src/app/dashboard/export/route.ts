import { qrExportCsv } from "@/lib/qr/export-csv";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/**
 * ดาวน์โหลด QR ทั้งหมดในบัญชีเป็น CSV
 *
 * ใช้ client ที่วิ่งผ่าน RLS เหมือนหน้า dashboard — ผู้ใช้ได้เฉพาะของตัวเอง
 * ไม่ต้องกรอง owner_id ซ้ำในโค้ด
 */
export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return new Response("unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("qr_codes")
    .select(
      "title, kind, qr_type, content, shortcode, current_target, status, created_at",
    )
    .order("created_at", { ascending: false });

  if (error !== null) return new Response("ส่งออกไม่สำเร็จ", { status: 500 });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(qrExportCsv(data, siteConfig.url), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="qr-export-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
