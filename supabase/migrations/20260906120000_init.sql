-- โครงข้อมูลของ Phase 3 — ดู docs/decisions/0004-dynamic-qr-data-model.md
--
-- หลักที่ยึดทั้งไฟล์นี้:
-- 1. ทุกตารางเปิด RLS และไม่มี policy ให้ anon เลย — สิ่งที่ anon ทำได้มีแค่ผ่าน function
-- 2. ข้อจำกัดเชิงธุรกิจบังคับที่ database ไม่ใช่แค่ในโค้ด (static ห้ามมี shortcode ฯลฯ)
-- 3. function ที่เป็น security definer ต้องคืนข้อมูลน้อยที่สุดเท่าที่งานนั้นต้องใช้

-- ---------------------------------------------------------------------------
-- ตาราง
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('static', 'dynamic')),
  title text not null default '',
  qr_type text not null
    check (qr_type in ('promptpay', 'url', 'wifi', 'line', 'vcard')),
  content jsonb not null,
  style jsonb not null default '{}'::jsonb,
  shortcode text unique,
  current_target text,
  status text not null default 'active'
    check (status in ('active', 'archived', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Business invariant ข้อ 1: static QR ต้องชี้ปลายทางตรง ห้ามมี shortcode
  constraint dynamic_needs_shortcode
    check ((kind = 'dynamic') = (shortcode is not null)),
  constraint dynamic_needs_target
    check ((kind = 'dynamic') = (current_target is not null)),
  -- dynamic ทำได้เฉพาะปลายทางที่เป็น URL — พร้อมเพย์/WiFi/นามบัตร เครื่องอ่านต้องอ่าน payload ตรง
  constraint dynamic_is_url_only
    check (kind = 'static' or qr_type in ('url', 'line'))
);

create index qr_codes_owner_idx
  on public.qr_codes (owner_id, created_at desc);

create table public.qr_versions (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid not null references public.qr_codes (id) on delete cascade,
  version integer not null,
  target_url text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (qr_code_id, version)
);

create table public.scans (
  id bigint generated always as identity primary key,
  qr_code_id uuid not null references public.qr_codes (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  country text,
  region text,
  device_type text
    check (device_type in ('mobile', 'tablet', 'desktop', 'bot', 'unknown')),
  referrer_host text,
  -- hash ที่ผูกกับทั้ง qr_code_id และวันที่ ทำให้ตามรอยข้าม QR หรือข้ามวันไม่ได้
  -- ดูข้อจำกัดที่ยอมรับไว้ใน docs/decisions/0006-scan-analytics-privacy.md
  ip_hash bytea
);

create index scans_qr_time_idx
  on public.scans (qr_code_id, scanned_at desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  billing_kind text check (billing_kind in ('monthly', 'yearly', 'lifetime')),
  status text not null default 'active'
    check (status in ('active', 'past_due', 'grace', 'canceled')),
  current_period_end timestamptz,
  grace_until timestamptz,
  gateway text,
  gateway_customer_id text,
  gateway_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- สิทธิ์ที่ใช้จริง แยกจาก billing โดยสิ้นเชิง (docs/prd.md §5.1)
-- source = 'manual' ไว้แจกสิทธิ์ให้ดีล B2B ที่ยังขายด้วยมือ
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null,
  quota integer,
  source text not null default 'plan' check (source in ('plan', 'manual')),
  expires_at timestamptz,
  unique (owner_id, feature)
);

-- เก็บใน database ไม่ใช่ในโค้ด เพื่อเติมคำใหม่ได้โดยไม่ต้อง deploy (ADR 0005)
create table public.shortcode_blocklist (
  fragment text primary key
);

-- ---------------------------------------------------------------------------
-- trigger
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger qr_codes_touch
  before update on public.qr_codes
  for each row execute function public.touch_updated_at();

create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- สมัครแล้วได้ profile กับ subscription ระดับฟรีทันที
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.subscriptions (owner_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- shortcode ที่บังเอิญมีคำต้องห้ามต้องถูกปฏิเสธ แล้วให้แอปสุ่มใหม่
create function public.reject_blocked_shortcode()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.shortcode is not null and exists (
    select 1 from public.shortcode_blocklist
    where new.shortcode like '%' || fragment || '%'
  ) then
    raise exception 'shortcode contains a blocked fragment'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger qr_codes_shortcode_guard
  before insert or update of shortcode on public.qr_codes
  for each row execute function public.reject_blocked_shortcode();

-- ---------------------------------------------------------------------------
-- สิทธิ์ระดับตาราง
--
-- ⚠️ RLS policy อย่างเดียวไม่พอ — Postgres ตรวจสิทธิ์ระดับตารางก่อนถึงจะดู policy
-- ถ้ามีแต่ policy จะได้ "permission denied" ทั้งที่เขียน policy ถูก
-- ประกาศไว้ตรงนี้ให้ชัดแทนที่จะพึ่ง default ของ Supabase ซึ่งมองไม่เห็นจากไฟล์นี้
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update, delete on public.qr_codes to authenticated;
grant select, update on public.profiles to authenticated;
-- สามตารางนี้เขียนผ่าน function เท่านั้น ผู้ใช้จึงได้แค่สิทธิ์อ่าน
grant select on public.qr_versions to authenticated;
grant select on public.scans to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.entitlements to authenticated;

-- anon ไม่ได้สิทธิ์ตารางใดเลย สิ่งที่ทำได้มีแค่เรียก function ที่ระบุไว้ท้ายไฟล์

-- ---------------------------------------------------------------------------
-- RLS — เปิดทุกตาราง ไม่มี policy ให้ anon เลย
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.qr_codes enable row level security;
alter table public.qr_versions enable row level security;
alter table public.scans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.shortcode_blocklist enable row level security;

-- ห่อ auth.uid() ด้วย select เพื่อให้ planner ประเมินครั้งเดียวต่อ query ไม่ใช่ต่อแถว
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy qr_codes_select_own on public.qr_codes
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy qr_codes_insert_own on public.qr_codes
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy qr_codes_update_own on public.qr_codes
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy qr_codes_delete_own on public.qr_codes
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy qr_versions_select_own on public.qr_versions
  for select to authenticated using (
    exists (
      select 1 from public.qr_codes
      where qr_codes.id = qr_versions.qr_code_id
        and qr_codes.owner_id = (select auth.uid())
    )
  );

create policy scans_select_own on public.scans
  for select to authenticated using (
    exists (
      select 1 from public.qr_codes
      where qr_codes.id = scans.qr_code_id
        and qr_codes.owner_id = (select auth.uid())
    )
  );

-- อ่านอย่างเดียว การเขียนเป็นหน้าที่ของ webhook ที่ใช้ service role
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy entitlements_select_own on public.entitlements
  for select to authenticated using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- function ที่เปิดให้เรียกจากภายนอก
-- ---------------------------------------------------------------------------

-- redirect ต้องอ่านครั้งเดียวจบเพื่อให้ทัน p95 < 100ms
-- คืนเฉพาะปลายทาง ไม่คืน id หรือเจ้าของ เพื่อไม่ให้ไล่ดูข้อมูลลูกค้าได้
create function public.resolve_shortcode(code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select current_target
  from public.qr_codes
  where shortcode = code
    and kind = 'dynamic'
    and status = 'active';
$$;

-- บันทึกการสแกน — รับ shortcode ไม่ใช่ id เพราะผู้เรียกไม่ควรรู้ id
--
-- ⚠️ ตอนนี้ anon เรียกได้ ทำให้มีคนยิงปั่นสถิติของคนอื่นได้
-- ยอมรับไว้ชั่วคราวเพื่อไม่ต้องเอา service role key ไปไว้ที่ edge
-- Phase 6 ต้องเพิ่ม rate limit หรือ token ก่อนเปิดขาย analytics
create function public.record_scan(
  code text,
  p_country text default null,
  p_region text default null,
  p_device_type text default null,
  p_referrer_host text default null,
  p_ip_hash bytea default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id
  from public.qr_codes
  where shortcode = code and kind = 'dynamic' and status = 'active';

  if target_id is null then
    return;
  end if;

  insert into public.scans (
    qr_code_id, country, region, device_type, referrer_host, ip_hash
  ) values (
    target_id, p_country, p_region, p_device_type, p_referrer_host, p_ip_hash
  );
end;
$$;

-- แก้ปลายทางพร้อมบันทึกประวัติใน transaction เดียว
-- ถ้าแยกเป็นสองคำสั่งจากฝั่งแอป มีโอกาสที่ประวัติกับปลายทางจริงไม่ตรงกัน
create function public.set_qr_target(qr_id uuid, new_target text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
begin
  if not exists (
    select 1 from public.qr_codes
    where id = qr_id
      and owner_id = (select auth.uid())
      and kind = 'dynamic'
  ) then
    raise exception 'not found or not owned by caller'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.qr_versions where qr_code_id = qr_id;

  insert into public.qr_versions (qr_code_id, version, target_url, created_by)
  values (qr_id, next_version, new_target, (select auth.uid()));

  update public.qr_codes
  set current_target = new_target
  where id = qr_id;

  return next_version;
end;
$$;

-- ลบ scan ดิบที่เลยกำหนดเก็บ — ตั้ง cron รายวันเรียกฟังก์ชันนี้
-- ระยะเก็บตาม docs/decisions/0006-scan-analytics-privacy.md
create function public.delete_expired_scans()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  with retention as (
    select
      c.id as qr_code_id,
      case s.plan
        when 'business' then interval '180 days'
        when 'pro' then interval '90 days'
        else interval '7 days'
      end as keep_for
    from public.qr_codes c
    join public.subscriptions s on s.owner_id = c.owner_id
  ),
  deleted as (
    delete from public.scans
    using retention
    where scans.qr_code_id = retention.qr_code_id
      and scans.scanned_at < now() - retention.keep_for
    returning 1
  )
  select count(*) into removed from deleted;

  return removed;
end;
$$;

-- ---------------------------------------------------------------------------
-- สิทธิ์การเรียก function
-- ---------------------------------------------------------------------------

revoke all on function public.resolve_shortcode(text) from public;
revoke all on function public.record_scan(text, text, text, text, text, bytea) from public;
revoke all on function public.set_qr_target(uuid, text) from public;
revoke all on function public.delete_expired_scans() from public;

grant execute on function public.resolve_shortcode(text) to anon, authenticated;
grant execute on function public.record_scan(text, text, text, text, text, bytea)
  to anon, authenticated;
grant execute on function public.set_qr_target(uuid, text) to authenticated;
grant execute on function public.delete_expired_scans() to service_role;

-- ---------------------------------------------------------------------------
-- ข้อมูลตั้งต้น
-- ---------------------------------------------------------------------------

insert into public.shortcode_blocklist (fragment) values
  ('fuck'), ('shit'), ('cunt'), ('rape'), ('nazi'), ('porn'), ('sex'),
  ('hia'), ('kuay'), ('hee'), ('sus');
