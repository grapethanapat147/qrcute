-- ---------------------------------------------------------------------------
-- checkout_sessions — บันทึกทุกครั้งที่มีคนกดเริ่มชำระเงิน
--
-- ทำไมต้องมี ทั้งที่ webhook อ่าน owner_id จาก metadata ได้อยู่แล้ว:
-- 1. เงินเข้าแต่ metadata หาย — webhook จะไม่รู้ว่าเป็นของใคร (process.ts บันทึกว่า
--    "ไม่พบ owner_id ใน metadata") ตารางนี้ให้เราจับคู่ด้วยรหัส charge แทนได้
-- 2. ราคาที่ลูกค้าเห็นตอนกดซื้อ ถ้าวันหนึ่งขึ้นราคาระหว่างที่เขากำลังจ่าย
--    เราต้องรู้ว่าเขาตกลงซื้อที่ราคาไหน
-- 3. เห็นว่ามีคนกดซื้อแล้วไม่จ่ายกี่คน — ตัวเลขแรกที่ต้องดูถ้าขายไม่ออก
-- ---------------------------------------------------------------------------
create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  price_code text not null,
  -- ราคา ณ ตอนที่กด ไม่ใช่ราคาปัจจุบัน — ดูข้อ 2 ข้างบน
  amount_satang integer not null check (amount_satang > 0),
  currency text not null default 'THB',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'expired')),
  gateway text not null default 'opn',
  gateway_charge_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint completed_needs_timestamp
    check ((status = 'completed') = (completed_at is not null))
);

create index checkout_sessions_owner_idx
  on public.checkout_sessions (owner_id, created_at desc);

create unique index checkout_sessions_charge_idx
  on public.checkout_sessions (gateway, gateway_charge_id)
  where gateway_charge_id is not null;

-- ---------------------------------------------------------------------------
-- สิทธิ์
--
-- ผู้ใช้อ่านของตัวเองได้ เพื่อแสดงสถานะ "กำลังรอการชำระเงิน"
-- แต่ "เขียนไม่ได้เลย" — ถ้าเขียนได้ ใครก็สร้างแถวที่ amount_satang = 100
-- แล้วอ้างว่าตกลงซื้อที่ราคานั้น ราคาต้องมาจากเซิร์ฟเวอร์เท่านั้น
-- ---------------------------------------------------------------------------
alter table public.checkout_sessions enable row level security;

grant select on public.checkout_sessions to authenticated;
grant select, insert, update on public.checkout_sessions to service_role;

create policy checkout_sessions_select_own on public.checkout_sessions
  for select to authenticated
  using (owner_id = (select auth.uid()));
