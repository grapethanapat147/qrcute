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

/**
 * สถานะของ QR ที่มีผลกับสิ่งที่คนสแกนเจอ
 *
 * active    = พาไปปลายทางทันที
 * suspended = เจ้าของพ้นช่วงผ่อนผัน — คนสแกนเห็นหน้าคั่นที่ยังกดไปต่อได้
 * disabled  = เลย 120 วันไปแล้ว — หน้าคั่นแจ้งว่าไม่ใช้งานแล้ว
 * ดู docs/decisions/0008-downgrade-behaviour.md
 */
export type ShortcodeState = "active" | "suspended" | "disabled";

export type ResolvedShortcode = {
  target: string | null;
  state: ShortcodeState;
};

function toState(value: unknown): ShortcodeState | null {
  return value === "active" || value === "suspended" || value === "disabled"
    ? value
    : null;
}

/**
 * คืนปลายทางและสถานะของ shortcode — null ถ้าไม่มีจริงหรือถูก archive
 *
 * ⚠️ ต้องไม่กรองสถานะทิ้งที่นี่ QR ที่ถูกพักไม่ใช่ 404
 * คนที่ยืนสแกนป้ายอยู่หน้าร้านต้องได้ทางไปต่อเสมอ (ADR 0008)
 */
export async function resolveShortcode(
  code: string,
  signal?: AbortSignal,
): Promise<ResolvedShortcode | null> {
  const response = await callRpc("resolve_shortcode", { code }, { signal });

  if (!response.ok) {
    throw new SupabaseRpcError(
      `resolve_shortcode ตอบ ${response.status}`,
      response.status,
    );
  }

  // function คืนเป็นตาราง PostgREST จึงห่อมาเป็น array เสมอ
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0] as { target?: unknown; state?: unknown };
  const state = toState(row.state);
  if (state === null) return null;

  return {
    target:
      typeof row.target === "string" && row.target !== "" ? row.target : null,
    state,
  };
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
