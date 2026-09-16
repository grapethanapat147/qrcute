-- ---------------------------------------------------------------------------
-- การลดระดับเมื่อลูกค้าเลิกจ่าย — ทำตาม docs/decisions/0008-downgrade-behaviour.md
--
-- หลักที่ ADR ยึด และไฟล์นี้ต้องรักษาไว้:
--   ปิดสิทธิ์ของ "เจ้าของ QR" ได้ทันที แต่อย่าเพิ่งตัดขาด "คนที่สแกน"
--   เพราะคนสแกนไม่เคยตกลงอะไรกับเรา และไม่รู้ด้วยซ้ำว่าเรามีตัวตน
--
-- QR ของเราถูกพิมพ์ติดป้ายไวนิลหน้าร้านจริง การปิด redirect ทันที
-- ไม่ได้ลงโทษลูกค้าเรา แต่ลงโทษ "ลูกค้าของลูกค้า" ที่ยืนสแกนอยู่หน้าร้าน
--
-- ลำดับเวลา: วันที่ 0 เก็บเงินไม่ผ่าน → 1–30 ผ่อนผัน (ทุกอย่างปกติ)
--            → 31 พัก QR ที่เกินโควตา (คนสแกนเห็นหน้าคั่นที่ยังกดไปต่อได้)
--            → 121 หน้าคั่นแจ้งว่าไม่ใช้งานแล้ว
-- ไม่มีขั้นตอนไหนลบข้อมูล กลับมาจ่ายเมื่อไรต้องได้ของเดิมคืนครบ
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- สถานะใหม่ของ qr_codes
--
-- suspended = ถูกพักเพราะเจ้าของหลุดโควตา ไม่ใช่เพราะเจ้าของสั่งปิด
-- ต้องแยกจาก disabled ให้ชัด เพราะสองอย่างนี้กลับคืนคนละแบบ
-- ---------------------------------------------------------------------------
alter table public.qr_codes
  drop constraint qr_codes_status_check;

alter table public.qr_codes
  add constraint qr_codes_status_check
    check (status in ('active', 'archived', 'disabled', 'suspended'));

-- เวลาที่ถูกพัก — ใช้นับ 120 วันก่อนหยุดทำงานจริง และใช้แยกว่า
-- QR ที่ disabled อยู่นั้นมาจากการพักของเรา หรือเจ้าของสั่งปิดเอง
alter table public.qr_codes
  add column suspended_at timestamptz;

alter table public.qr_codes
  add constraint suspended_needs_timestamp
    check (status <> 'suspended' or suspended_at is not null);

-- ---------------------------------------------------------------------------
-- โควตา dynamic QR ของแพ็กเกจฟรี
--
-- ⚠️ ค่านี้ซ้ำกับ PLAN_QUOTAS.free.dynamic_qr ใน src/lib/billing/entitlements.ts
-- ซึ่งเป็น source of truth — ที่นี่จำเป็นต้องรู้ด้วยเพราะการพัก QR ทำใน SQL
-- มี test ใน src/lib/billing/quota-drift.test.ts คอยจับว่าสองที่นี้ตรงกันอยู่
-- ---------------------------------------------------------------------------
create function public.free_dynamic_qr_quota()
returns integer
language sql
immutable
as $$ select 2 $$;

-- ---------------------------------------------------------------------------
-- run_downgrade_sweep — งานรายวันที่เดินตามลำดับเวลาใน ADR
--
-- เขียนให้เรียกซ้ำได้โดยผลไม่เปลี่ยน เพราะ cron พลาดแล้วรันชดเชยเป็นเรื่องปกติ
-- ---------------------------------------------------------------------------
create function public.run_downgrade_sweep()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quota integer := public.free_dynamic_qr_quota();
  suspended_count integer := 0;
  disabled_count integer := 0;
begin
  -- วันที่ 31: พัก QR ที่เกินโควตาฟรีของคนที่พ้นช่วงผ่อนผันแล้ว
  --
  -- พักจากอันที่สร้างล่าสุดย้อนขึ้นไป เก็บอันเก่าที่สุดไว้ตามโควตา
  -- เพราะ QR ที่สร้างนานแล้วมีโอกาสถูกพิมพ์และแจกจ่ายไปมากกว่า
  -- การพักอันที่เพิ่งสร้างจึงกระทบโลกจริงน้อยกว่า
  with lapsed as (
    select owner_id
    from public.subscriptions
    where plan <> 'free'
      and (
        -- เก็บเงินไม่ผ่านแล้วหมดเวลาผ่อนผัน
        (status in ('past_due', 'grace')
          and grace_until is not null
          and grace_until < now())
        -- หรือยกเลิกเองแล้วเลยรอบที่จ่ายไว้
        or (status = 'canceled'
          and (current_period_end is null or current_period_end < now()))
      )
  ),
  ranked as (
    select
      c.id,
      row_number() over (
        partition by c.owner_id order by c.created_at
      ) as position
    from public.qr_codes c
    join lapsed l on l.owner_id = c.owner_id
    where c.kind = 'dynamic'
      and c.status = 'active'
  ),
  suspended as (
    update public.qr_codes
    set status = 'suspended', suspended_at = now()
    from ranked
    where qr_codes.id = ranked.id
      and ranked.position > quota
    returning 1
  )
  select count(*) into suspended_count from suspended;

  -- วันที่ 121: หยุดพา redirect จริง แต่ยังไม่ลบอะไร
  with expired as (
    update public.qr_codes
    set status = 'disabled'
    where status = 'suspended'
      and suspended_at < now() - interval '120 days'
    returning 1
  )
  select count(*) into disabled_count from expired;

  return jsonb_build_object(
    'suspended', suspended_count,
    'disabled', disabled_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- restore_suspended_qr_codes — กลับมาจ่ายแล้วต้องได้ของเดิมคืนครบทันที
--
-- แตะเฉพาะอันที่ suspended_at ไม่ว่าง คือเฉพาะอันที่ระบบเราเป็นคนพัก
-- QR ที่เจ้าของสั่งปิดเองต้องไม่ถูกเปิดคืนโดยไม่ได้ขอ
-- ---------------------------------------------------------------------------
create function public.restore_suspended_qr_codes(p_owner_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  restored integer;
begin
  with revived as (
    update public.qr_codes
    set status = 'active', suspended_at = null
    where owner_id = p_owner_id
      and status in ('suspended', 'disabled')
      and suspended_at is not null
    returning 1
  )
  select count(*) into restored from revived;

  return restored;
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_shortcode — ต้องบอกสถานะกลับมาด้วย ไม่ใช่แค่ปลายทาง
--
-- เดิมคืนแค่ปลายทาง และกรองเฉพาะ status = 'active' ทำให้ QR ที่ถูกพัก
-- กลายเป็น 404 ซึ่งขัดกับ ADR ที่บอกว่าคนสแกนต้องยังกดไปปลายทางเดิมได้
-- เปลี่ยน return type จึงต้อง drop ก่อน
-- ---------------------------------------------------------------------------
drop function public.resolve_shortcode(text);

create function public.resolve_shortcode(code text)
returns table (target text, state text)
language sql
stable
security definer
set search_path = public
as $$
  select current_target, status
  from public.qr_codes
  where shortcode = code
    and kind = 'dynamic'
    -- archived คือเจ้าของลบทิ้งเอง ต้องเป็น 404 เหมือนเดิม
    and status in ('active', 'suspended', 'disabled');
$$;

-- ---------------------------------------------------------------------------
-- record_scan — นับการสแกนของ QR ที่ถูกพักด้วย
--
-- คนยังยืนสแกนป้ายอยู่จริงแม้เจ้าของจะหยุดจ่าย ตัวเลขนี้คือเหตุผลที่หนักแน่นที่สุด
-- ที่จะทำให้เจ้าของร้านกลับมาจ่าย — ถ้าไม่นับ เราจะไม่มีอะไรไปบอกเขาเลย
-- ---------------------------------------------------------------------------
create or replace function public.record_scan(
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
  where shortcode = code
    and kind = 'dynamic'
    and status in ('active', 'suspended');

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

-- ---------------------------------------------------------------------------
-- สิทธิ์การเรียก function
--
-- resolve_shortcode ถูกสร้างใหม่ สิทธิ์เดิมหายไปพร้อมของเก่า ต้องให้ใหม่ทั้งหมด
-- ---------------------------------------------------------------------------
revoke all on function public.resolve_shortcode(text) from public;
revoke all on function public.free_dynamic_qr_quota() from public;
revoke all on function public.run_downgrade_sweep() from public;
revoke all on function public.restore_suspended_qr_codes(uuid) from public;

grant execute on function public.resolve_shortcode(text) to anon, authenticated;
grant execute on function public.run_downgrade_sweep() to service_role;
grant execute on function public.restore_suspended_qr_codes(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 🔴 ปิดช่องเลี่ยงการถูกพัก
--
-- เดิม authenticated มีสิทธิ์ update ทั้งตาราง qr_codes และ RLS policy อนุญาต
-- ให้แก้แถวของตัวเองได้ ซึ่งแปลว่าคนที่ถูกพักเพราะเลิกจ่าย แค่ยิง
--   update qr_codes set status = 'active' where id = ...
-- ด้วย anon key กับ JWT ของตัวเองจากเบราว์เซอร์ ก็ปลดล็อกคืนได้เองทันที
-- ทั้งระบบการลดระดับจึงไม่มีผลอะไรเลย
--
-- ตรวจพบจาก supabase/tests/rls.sql กลุ่มที่ 16 ตอนเขียนสเปกนี้
--
-- ทางแก้: ให้สิทธิ์ update เฉพาะคอลัมน์ที่เจ้าของควรแก้เองได้จริง ๆ
-- ส่วน status ย้ายไปทำผ่าน function ที่บังคับกติกาการเปลี่ยนสถานะ
-- ---------------------------------------------------------------------------

revoke update on public.qr_codes from authenticated;
grant update (title, style) on public.qr_codes to authenticated;

-- ---------------------------------------------------------------------------
-- set_qr_status — เจ้าของเก็บเข้าคลัง/เอากลับมาใช้เองได้ แต่ปลดการพักไม่ได้
-- ---------------------------------------------------------------------------
create function public.set_qr_status(qr_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if new_status not in ('active', 'archived') then
    raise exception 'สถานะนี้เปลี่ยนเองไม่ได้'
      using errcode = 'insufficient_privilege';
  end if;

  select status into current_status
  from public.qr_codes
  where id = qr_id and owner_id = (select auth.uid());

  if current_status is null then
    raise exception 'not found or not owned by caller'
      using errcode = 'insufficient_privilege';
  end if;

  -- suspended/disabled ปลดได้ทางเดียวคือกลับมาจ่ายเงิน (ADR 0008)
  if current_status not in ('active', 'archived') then
    raise exception 'QR นี้ถูกพักอยู่ ต้องเปิดแพ็กเกจก่อนถึงจะกลับมาใช้ได้'
      using errcode = 'insufficient_privilege';
  end if;

  update public.qr_codes set status = new_status where id = qr_id;
end;
$$;

revoke all on function public.set_qr_status(uuid, text) from public;
grant execute on function public.set_qr_status(uuid, text) to authenticated;
