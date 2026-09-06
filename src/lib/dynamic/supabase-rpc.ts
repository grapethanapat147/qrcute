/**
 * เรียก function ของ Postgres ผ่าน PostgREST ด้วย fetch ตรง ๆ
 *
 * จงใจไม่ใช้ @supabase/supabase-js ตรงนี้ เพราะเส้นทาง /r/[code] ต้องตอบ p95 < 100ms
 * และเรียกแค่สอง function — ไลบรารีเต็มตัวเพิ่มเวลา cold start โดยไม่ได้อะไรกลับมา
 *
 * ใช้ anon key เท่านั้น ไม่เอา service role key มาไว้ที่ edge
 * สิ่งที่ anon ทำได้ถูกจำกัดด้วย grant ใน migration แล้ว
 */

export class SupabaseRpcError extends Error {
  override name = "SupabaseRpcError";
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new SupabaseRpcError(`ยังไม่ได้ตั้งค่า ${name}`, 500);
  }
  return value;
}

async function callRpc(
  name: string,
  args: Record<string, unknown>,
  init: { signal?: AbortSignal } = {},
): Promise<Response> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: init.signal,
  });
}

/** คืนปลายทางของ shortcode หรือ null ถ้าไม่มี ถูกปิด หรือถูก archive */
export async function resolveShortcode(
  code: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await callRpc("resolve_shortcode", { code }, { signal });

  if (!response.ok) {
    throw new SupabaseRpcError(
      `resolve_shortcode ตอบ ${response.status}`,
      response.status,
    );
  }

  const target: unknown = await response.json();
  return typeof target === "string" && target !== "" ? target : null;
}

export type RecordScanInput = {
  code: string;
  country: string | null;
  region: string | null;
  deviceType: string;
  referrerHost: string | null;
  ipHashHex: string | null;
};

/**
 * บันทึกการสแกน — ต้องไม่ถูก await ก่อนตอบ redirect
 *
 * ยอมให้พลาดได้ถ้าล้มเหลว สถิติหายหนึ่งครั้งไม่เท่ากับลูกค้ายืนรอหน้าร้าน
 */
export async function recordScan(input: RecordScanInput): Promise<void> {
  const response = await callRpc("record_scan", {
    code: input.code,
    p_country: input.country,
    p_region: input.region,
    p_device_type: input.deviceType,
    p_referrer_host: input.referrerHost,
    // bytea ของ PostgREST รับรูปแบบ hex ที่ขึ้นต้นด้วย \x
    p_ip_hash: input.ipHashHex === null ? null : `\\x${input.ipHashHex}`,
  });

  if (!response.ok) {
    throw new SupabaseRpcError(
      `record_scan ตอบ ${response.status}`,
      response.status,
    );
  }
}
