-- ทดสอบลำดับเวลาการลดระดับเมื่อลูกค้าเลิกจ่าย กับ database จริง
--
-- สเปกอยู่ใน docs/decisions/0008-downgrade-behaviour.md
-- สิ่งที่ไฟล์นี้ต้องพิสูจน์ให้ได้ทุกครั้ง คือคำสัญญาสามข้อที่เราให้ไว้:
--   1. QR ที่ถูกพัก "ยังต้องบอกปลายทางได้" ไม่ใช่ 404
--      เพราะคนที่เดือดร้อนคือลูกค้าของลูกค้าเรา ที่ยืนสแกนป้ายอยู่หน้าร้าน
--   2. พักจากอันที่สร้างล่าสุดย้อนขึ้นไป — อันเก่าถูกพิมพ์แจกไปมากกว่า
--   3. กลับมาจ่ายเมื่อไรต้องได้ของเดิมคืนครบ ไม่มีขั้นตอนไหนลบข้อมูล
--
-- รันด้วย: bun run test:downgrade   (ต้อง supabase start ก่อน)
-- ทั้งไฟล์อยู่ใน transaction เดียวและ rollback ตอนจบ ไม่ทิ้งข้อมูลไว้

begin;

\set ON_ERROR_STOP on
\set QUIET on
delete from auth.users;

do $$
declare
  som uuid := '11111111-1111-1111-1111-111111111111';
  fon uuid := '22222222-2222-2222-2222-222222222222';
  result jsonb;
  n integer;
  target text;
  state text;
begin
  insert into auth.users (id, email, aud, role)
  values (som, 'som@example.com', 'authenticated', 'authenticated'),
         (fon, 'fon@example.com', 'authenticated', 'authenticated');

  -- สมชาย: Pro ที่เก็บเงินไม่ผ่านและหมดผ่อนผันไปแล้ว 1 วัน
  update public.subscriptions
  set plan = 'pro', billing_kind = 'monthly', status = 'past_due',
      grace_until = now() - interval '1 day'
  where owner_id = som;

  -- ฝน: Pro ที่ยังจ่ายอยู่ปกติ ต้องไม่ถูกแตะเลย
  update public.subscriptions
  set plan = 'pro', billing_kind = 'monthly', status = 'active',
      current_period_end = now() + interval '20 days'
  where owner_id = fon;

  insert into public.qr_codes
    (owner_id, kind, title, qr_type, content, shortcode, current_target, created_at)
  values
    (som,'dynamic','ป้ายหน้าร้าน (เก่าสุด)','url','{}'::jsonb,'s0000a1','https://som.example/1', now() - interval '300 days'),
    (som,'dynamic','เมนู','url','{}'::jsonb,'s0000b2','https://som.example/2', now() - interval '200 days'),
    (som,'dynamic','โปรโมชัน','url','{}'::jsonb,'s0000c3','https://som.example/3', now() - interval '100 days'),
    (som,'dynamic','ใบปลิว','url','{}'::jsonb,'s0000d4','https://som.example/4', now() - interval '50 days'),
    (som,'dynamic','สติกเกอร์ (ใหม่สุด)','url','{}'::jsonb,'s0000e5','https://som.example/5', now() - interval '5 days'),
    (fon,'dynamic','ของฝน','url','{}'::jsonb,'f0000a1','https://fon.example/1', now() - interval '10 days');

  -- 1 กวาดครั้งแรก
  result := public.run_downgrade_sweep();
  assert (result->>'suspended')::int = 3,
    format('ต้องพัก 3 อัน (5 - โควตาฟรี 2) แต่พัก %s', result->>'suspended');

  select count(*) into n from public.qr_codes
  where owner_id = som and status = 'active';
  assert n = 2, format('ต้องเหลือ active 2 อัน แต่เหลือ %s', n);

  assert (select status from public.qr_codes where shortcode = 's0000a1') = 'active',
    'อันที่เก่าที่สุดต้องรอด เพราะมีโอกาสถูกพิมพ์แจกไปมากที่สุด';
  assert (select status from public.qr_codes where shortcode = 's0000b2') = 'active',
    'อันที่เก่าอันดับสองต้องรอด';
  assert (select status from public.qr_codes where shortcode = 's0000e5') = 'suspended',
    'อันที่เพิ่งสร้างต้องถูกพักก่อน';

  assert (select status from public.qr_codes where shortcode = 'f0000a1') = 'active',
    'คนที่ยังจ่ายอยู่ต้องไม่ถูกแตะ';

  -- 2 กวาดซ้ำต้องไม่พักเพิ่ม
  result := public.run_downgrade_sweep();
  assert (result->>'suspended')::int = 0,
    format('กวาดซ้ำต้องไม่พักเพิ่ม แต่พักอีก %s', result->>'suspended');

  -- 3 QR ที่ถูกพักต้องยังบอกปลายทางได้ (หัวใจของ ADR 0008)
  select r.target, r.state into target, state
  from public.resolve_shortcode('s0000e5') r;
  assert state = 'suspended', format('สถานะต้องเป็น suspended ได้ %s', state);
  assert target = 'https://som.example/5',
    'QR ที่ถูกพักต้องยังคืนปลายทางเดิม ไม่ใช่ 404';

  -- 4 การสแกน QR ที่ถูกพักต้องยังถูกนับ
  perform public.record_scan('s0000e5', 'TH', '10', 'mobile', null, null);
  select count(*) into n from public.scans s
  join public.qr_codes c on c.id = s.qr_code_id
  where c.shortcode = 's0000e5';
  assert n = 1, 'ต้องนับการสแกนของ QR ที่ถูกพักไว้ด้วย';

  -- 5 วันที่ 121 หยุดทำงาน
  update public.qr_codes
  set suspended_at = now() - interval '121 days'
  where shortcode = 's0000e5';

  result := public.run_downgrade_sweep();
  assert (result->>'disabled')::int = 1,
    format('ต้องปิด 1 อัน แต่ปิด %s', result->>'disabled');

  select r.state into state from public.resolve_shortcode('s0000e5') r;
  assert state = 'disabled', format('สถานะต้องเป็น disabled ได้ %s', state);

  -- 6 กลับมาจ่ายแล้วต้องได้คืนครบ รวมอันที่เลย 120 วันไปแล้ว
  n := public.restore_suspended_qr_codes(som);
  assert n = 3, format('ต้องคืน 3 อัน แต่คืน %s', n);

  select count(*) into n from public.qr_codes
  where owner_id = som and status = 'active' and suspended_at is null;
  assert n = 5, format('สมชายต้องได้ QR ครบ 5 อันเหมือนเดิม แต่ได้ %s', n);

  -- 7 อันที่เจ้าของสั่งปิดเอง ต้องไม่ถูกเปิดคืนโดยไม่ได้ขอ
  update public.qr_codes set status = 'disabled' where shortcode = 's0000c3';
  n := public.restore_suspended_qr_codes(som);
  assert n = 0, 'ไม่มีอะไรให้คืนแล้ว';
  assert (select status from public.qr_codes where shortcode = 's0000c3') = 'disabled',
    'QR ที่เจ้าของสั่งปิดเองต้องอยู่เฉย ๆ';

  -- 8 archived ต้องยังเป็น 404 เหมือนเดิม
  update public.qr_codes set status = 'archived' where shortcode = 's0000d4';
  assert not exists (select 1 from public.resolve_shortcode('s0000d4')),
    'QR ที่ถูก archive ต้องหาไม่เจอ';

  -- 9 constraint กันสถานะ suspended ที่ไม่มีเวลากำกับ
  begin
    update public.qr_codes set status = 'suspended', suspended_at = null
    where shortcode = 's0000a1';
    assert false, 'ต้องพักโดยไม่บันทึกเวลาไม่ได้';
  exception when check_violation then null;
  end;
end;
$$;

\echo 'ลำดับเวลาการลดระดับตาม ADR 0008 ผ่านทั้งหมด'
rollback;
