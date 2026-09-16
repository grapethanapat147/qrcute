-- ---------------------------------------------------------------------------
-- Billing — ตารางสำหรับรับ webhook และเก็บประวัติการจ่ายเงิน
--
-- ผู้ให้บริการที่ใช้: Opn Payments (Omise) — ดู docs/decisions/0007-payment-gateway.md
-- แต่ทุกตารางในไฟล์นี้เก็บชื่อ gateway เป็นคอลัมน์ ไม่ใช่ชื่อตาราง
-- เพื่อให้ย้ายเจ้าได้โดยไม่ต้อง migrate ข้อมูลเก่า
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- webhook_events — กันเหตุการณ์ซ้ำ และเก็บของดิบไว้ตรวจย้อนหลัง
--
-- นี่คือกลไกที่ทำให้ข้อกำหนดใน docs/prd.md §5.1 ข้อ 1 เป็นจริง:
-- "ยิงเหตุการณ์เดิมซ้ำหลายครั้ง สิทธิ์ต้องไม่เปลี่ยนเกินหนึ่งครั้ง"
-- primary key คือคู่ (gateway, event_id) — insert ครั้งที่สองจะชนกุญแจเสมอ
--
-- ⚠️ Omise ไม่รับประกันการยิงซ้ำเมื่อส่งไม่สำเร็จ (https://docs.omise.co/api-webhooks)
-- ตารางนี้จึงต้องเก็บ payload ดิบไว้ด้วย เพื่อให้งาน reconcile เอาไปเทียบกับ
-- GET /events ของ Opn ได้ว่ามีเหตุการณ์ไหนหล่นหายไปบ้าง
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  gateway text not null,
  event_id text not null,
  event_key text not null,
  -- เก็บ body ดิบเป็นข้อความ ไม่ใช่ jsonb เพราะลายเซ็นเซ็นบนไบต์ชุดนี้
  -- ถ้าแปลงเป็น jsonb แล้วแปลงกลับ ลำดับคีย์จะเปลี่ยนและตรวจซ้ำไม่ได้อีก
  raw_body text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  -- ผลของการประมวลผล เช่น activate / payment_failed / ignore:<เหตุผล>
  outcome text,
  primary key (gateway, event_id)
);

create index webhook_events_unprocessed_idx
  on public.webhook_events (received_at desc)
  where processed_at is null;

-- ---------------------------------------------------------------------------
-- payments — ประวัติการจ่ายเงินสำหรับออกใบเสร็จและกระทบยอด
--
-- owner_id เป็น set null ตอนลบบัญชี ไม่ใช่ cascade เพราะรายการรับเงินจริง
-- ต้องเก็บไว้ทำบัญชี/ภาษีแม้ผู้ใช้จะลบบัญชีไปแล้ว
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  gateway text not null,
  gateway_charge_id text not null,
  price_code text,
  -- หน่วยเป็นสตางค์เสมอ ห้ามใช้ทศนิยมกับเงิน
  amount_satang integer not null check (amount_satang >= 0),
  currency text not null default 'THB',
  status text not null
    check (status in ('successful', 'failed', 'pending', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),

  unique (gateway, gateway_charge_id)
);

create index payments_owner_idx
  on public.payments (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- subscriptions — กันเหตุการณ์ที่มาถึงสลับลำดับ
--
-- เหตุการณ์จาก gateway ไม่รับประกันว่าจะมาเรียงตามเวลา ถ้าเหตุการณ์เก่ามาถึงทีหลัง
-- แล้วเราเขียนทับดื้อ ๆ ลูกค้าที่เพิ่งจ่ายเงินสำเร็จจะถูกลดสิทธิ์ด้วยเหตุการณ์เก่า
-- คอลัมน์นี้ให้เราปฏิเสธการเขียนที่เก่ากว่าของที่เขียนไปแล้ว
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add column last_event_at timestamptz;

-- ---------------------------------------------------------------------------
-- สิทธิ์
--
-- webhook_events ไม่ให้ใครนอกจาก service_role แตะ — เปิด RLS ไว้โดยไม่มี policy
-- แปลว่า anon/authenticated ถูกปฏิเสธทุกคำสั่ง ส่วน service_role ข้าม RLS อยู่แล้ว
-- payments ให้เจ้าของอ่านของตัวเองได้ เพื่อทำหน้าประวัติการจ่ายเงิน
-- แต่เขียนไม่ได้ — มีแต่ webhook ที่เขียนได้
-- ---------------------------------------------------------------------------
alter table public.webhook_events enable row level security;
alter table public.payments enable row level security;

-- ⚠️ service_role ข้าม RLS ก็จริง แต่ยังต้องมีสิทธิ์ระดับตาราง
-- Supabase ไม่ได้ให้ DML กับ service_role อัตโนมัติสำหรับตารางที่เราสร้างเอง
-- (ตรวจแล้วด้วย information_schema.role_table_grants — ได้มาแค่ REFERENCES/TRIGGER/TRUNCATE)
-- ถ้าไม่มีบรรทัดนี้ webhook จะพังด้วย "permission denied for table webhook_events"
grant select, insert, update on public.webhook_events to service_role;
grant select, insert, update on public.payments to service_role;

-- webhook ต้องอ่านสถานะปัจจุบันก่อนคำนวณสถานะใหม่
-- เขียนไม่ต้องให้ เพราะเขียนผ่าน apply_billing_event ที่เป็น security definer
grant select on public.subscriptions to service_role;

grant select on public.payments to authenticated;

create policy payments_select_own on public.payments
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- apply_billing_event — เขียนสถานะใหม่แบบไม่ทับของที่ใหม่กว่า
--
-- ตรรกะว่าเหตุการณ์ไหนแปลว่าอะไรอยู่ใน TypeScript (src/lib/billing/billing-events.ts)
-- ที่นี่ทำแค่เรื่องที่ต้องอะตอมมิกจริง ๆ คือเทียบเวลาแล้วเขียน
-- คืน true ถ้าเขียนจริง คืน false ถ้ามีเหตุการณ์ที่ใหม่กว่าเขียนไปก่อนแล้ว
-- ---------------------------------------------------------------------------
create function public.apply_billing_event(
  p_owner_id uuid,
  p_event_at timestamptz,
  p_plan text,
  p_billing_kind text,
  p_status text,
  p_current_period_end timestamptz,
  p_grace_until timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  written integer;
begin
  update public.subscriptions
  set plan = p_plan,
      billing_kind = p_billing_kind,
      status = p_status,
      current_period_end = p_current_period_end,
      grace_until = p_grace_until,
      last_event_at = p_event_at,
      gateway = 'opn'
  where owner_id = p_owner_id
    and (last_event_at is null or last_event_at <= p_event_at);

  get diagnostics written = row_count;
  return written > 0;
end;
$$;

revoke all on function public.apply_billing_event(
  uuid, timestamptz, text, text, text, timestamptz, timestamptz
) from public;

grant execute on function public.apply_billing_event(
  uuid, timestamptz, text, text, text, timestamptz, timestamptz
) to service_role;
