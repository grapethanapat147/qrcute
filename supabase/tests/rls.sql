-- ทดสอบ RLS และ constraint กับ database จริง
--
-- RLS เป็นชั้นกันข้อมูลรั่วชั้นเดียวที่โปรเจกต์นี้มี และเจ้าของทำคนเดียวไม่มี code review
-- จึงต้องมีชุดทดสอบที่พิสูจน์ว่าผู้ใช้คนหนึ่งแตะข้อมูลของอีกคนไม่ได้จริง ๆ
--
-- รันด้วย: bun run test:rls   (ต้อง supabase start ก่อน)
-- ทั้งไฟล์อยู่ใน transaction เดียวและ rollback ตอนจบ ไม่ทิ้งข้อมูลไว้

begin;

\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.act_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function pg_temp.act_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function pg_temp.act_as_admin() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- เตรียมข้อมูล: ผู้ใช้สองคน คนละ QR
--
-- ล้างข้อมูลเดิมก่อน เพื่อให้ผลลัพธ์ไม่ขึ้นกับว่าเครื่องนั้นเคยกรอกอะไรไว้
-- ปลอดภัยเพราะทั้งไฟล์อยู่ใน transaction เดียวและ rollback ตอนจบ
-- ---------------------------------------------------------------------------

delete from auth.users;

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  bob   uuid := '22222222-2222-2222-2222-222222222222';
begin
  insert into auth.users (id, email, aud, role)
  values (alice, 'alice@example.com', 'authenticated', 'authenticated'),
         (bob, 'bob@example.com', 'authenticated', 'authenticated');

  insert into public.qr_codes
    (id, owner_id, kind, title, qr_type, content, shortcode, current_target)
  values
    ('aaaaaaaa-0000-0000-0000-000000000001', alice, 'dynamic', 'เมนูร้านอลิซ',
     'url', '{"type":"url","url":"https://alice.example/menu"}'::jsonb,
     'a2c4e6g', 'https://alice.example/menu'),
    ('bbbbbbbb-0000-0000-0000-000000000002', bob, 'dynamic', 'เมนูร้านบ๊อบ',
     'url', '{"type":"url","url":"https://bob.example/menu"}'::jsonb,
     'b3d5f7h', 'https://bob.example/menu');
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. trigger สร้าง profile และ subscription ให้อัตโนมัติตอนสมัคร
-- ---------------------------------------------------------------------------

do $$
begin
  assert (select count(*) from public.profiles) = 2,
    'สมัครแล้วต้องได้ profile อัตโนมัติ';
  assert (select count(*) from public.subscriptions where plan = 'free') = 2,
    'สมัครแล้วต้องได้ subscription ระดับฟรีอัตโนมัติ';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. ผู้ใช้เห็นเฉพาะ QR ของตัวเอง
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  visible int;
begin
  perform pg_temp.act_as(alice);

  select count(*) into visible from public.qr_codes;
  assert visible = 1, format('อลิซควรเห็น QR 1 อัน แต่เห็น %s อัน', visible);

  select count(*) into visible from public.qr_codes where owner_id <> alice;
  assert visible = 0, 'อลิซต้องไม่เห็น QR ของคนอื่นเลย';

  perform pg_temp.act_as_admin();
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. แก้ QR ของคนอื่นไม่ได้ และลบไม่ได้
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  affected int;
begin
  perform pg_temp.act_as(alice);

  update public.qr_codes set title = 'ยึดแล้ว'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  assert affected = 0, 'อลิซแก้ QR ของบ๊อบไม่ได้';

  delete from public.qr_codes
  where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  assert affected = 0, 'อลิซลบ QR ของบ๊อบไม่ได้';

  perform pg_temp.act_as_admin();
  assert (select title from public.qr_codes
          where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'เมนูร้านบ๊อบ',
    'ข้อมูลของบ๊อบต้องไม่ถูกแตะเลย';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. สร้าง QR ในนามคนอื่นไม่ได้
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  bob   uuid := '22222222-2222-2222-2222-222222222222';
  blocked boolean := false;
begin
  perform pg_temp.act_as(alice);
  begin
    insert into public.qr_codes (owner_id, kind, qr_type, content)
    values (bob, 'static', 'url', '{"type":"url","url":"https://evil.example"}'::jsonb);
  exception when insufficient_privilege or others then
    blocked := true;
  end;
  assert blocked, 'อลิซสร้าง QR ในนามบ๊อบไม่ได้';
  perform pg_temp.act_as_admin();
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. anon อ่านตารางไม่ได้เลย
-- ---------------------------------------------------------------------------

-- anon ถูกกันตั้งแต่ระดับตาราง จึงได้ error ไม่ใช่ผลลัพธ์ว่าง
-- ซึ่งแข็งแรงกว่า เพราะไม่ต้องพึ่ง policy ให้ถูกด้วยซ้ำ
do $$
declare
  table_name text;
  denied boolean;
begin
  perform pg_temp.act_as_anon();

  foreach table_name in array array[
    'qr_codes', 'profiles', 'qr_versions', 'scans', 'subscriptions', 'entitlements'
  ] loop
    denied := false;
    begin
      execute format('select count(*) from public.%I', table_name);
    exception when insufficient_privilege then
      denied := true;
    end;
    assert denied, format('anon ต้องอ่าน %s ไม่ได้เลย', table_name);
  end loop;

  perform pg_temp.act_as_admin();
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. anon เรียก resolve_shortcode ได้ และได้เฉพาะปลายทางกับสถานะ
-- ---------------------------------------------------------------------------

do $$
declare
  target text;
  state text;
begin
  perform pg_temp.act_as_anon();

  select r.target, r.state into target, state
  from public.resolve_shortcode('a2c4e6g') r;
  assert target = 'https://alice.example/menu' and state = 'active',
    'anon ต้อง resolve shortcode ที่ใช้งานอยู่ได้';

  assert not exists (select 1 from public.resolve_shortcode('ไม่มีจริง')),
    'shortcode ที่ไม่มีต้องหาไม่เจอ';

  perform pg_temp.act_as_admin();
  update public.qr_codes set status = 'archived' where shortcode = 'a2c4e6g';

  perform pg_temp.act_as_anon();
  assert not exists (select 1 from public.resolve_shortcode('a2c4e6g')),
    'QR ที่เจ้าของลบทิ้งต้อง resolve ไม่ได้';

  -- QR ที่ถูกพักเพราะเลิกจ่ายต้องยังคืนปลายทาง — คนสแกนต้องมีทางไปต่อ (ADR 0008)
  perform pg_temp.act_as_admin();
  update public.qr_codes set status = 'suspended', suspended_at = now()
  where shortcode = 'a2c4e6g';

  perform pg_temp.act_as_anon();
  select r.target, r.state into target, state
  from public.resolve_shortcode('a2c4e6g') r;
  assert target = 'https://alice.example/menu' and state = 'suspended',
    'QR ที่ถูกพักต้องยังคืนปลายทางเดิม ไม่ใช่หาไม่เจอ';

  perform pg_temp.act_as_admin();
  update public.qr_codes set status = 'active', suspended_at = null
  where shortcode = 'a2c4e6g';
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. record_scan บันทึกให้ QR ที่ถูกต้อง และเจ้าของเห็นเฉพาะของตัวเอง
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  bob   uuid := '22222222-2222-2222-2222-222222222222';
  visible int;
begin
  perform pg_temp.act_as_anon();
  perform public.record_scan('a2c4e6g', 'TH', 'กรุงเทพมหานคร', 'mobile', 'line.me', null);
  perform public.record_scan('b3d5f7h', 'TH', 'เชียงใหม่', 'mobile', null, null);
  perform public.record_scan('ไม่มีจริง', 'TH', null, 'mobile', null, null);

  perform pg_temp.act_as_admin();
  assert (select count(*) from public.scans) = 2,
    'shortcode ที่ไม่มีต้องไม่สร้างแถว scan';

  perform pg_temp.act_as(alice);
  select count(*) into visible from public.scans;
  assert visible = 1, format('อลิซควรเห็น scan 1 แถว แต่เห็น %s', visible);

  perform pg_temp.act_as(bob);
  select count(*) into visible from public.scans;
  assert visible = 1, 'บ๊อบควรเห็น scan ของตัวเอง 1 แถว';

  perform pg_temp.act_as_admin();
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. set_qr_target บันทึกประวัติและอัปเดตปลายทางพร้อมกัน
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  qr uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v int;
  blocked boolean := false;
begin
  perform pg_temp.act_as(alice);

  v := public.set_qr_target(qr, 'https://alice.example/menu-v2');
  assert v = 1, 'เวอร์ชันแรกต้องเป็น 1';
  v := public.set_qr_target(qr, 'https://alice.example/menu-v3');
  assert v = 2, 'เวอร์ชันต้องเดินหน้าทีละหนึ่ง';

  assert (select current_target from public.qr_codes where id = qr)
    = 'https://alice.example/menu-v3',
    'ปลายทางปัจจุบันต้องตรงกับเวอร์ชันล่าสุด';
  assert (select count(*) from public.qr_versions where qr_code_id = qr) = 2,
    'ต้องมีประวัติครบทุกครั้งที่แก้';

  -- แก้ของบ๊อบไม่ได้
  begin
    perform public.set_qr_target('bbbbbbbb-0000-0000-0000-000000000002',
                                 'https://evil.example');
  exception when others then
    blocked := true;
  end;
  assert blocked, 'อลิซแก้ปลายทางของบ๊อบไม่ได้';

  perform pg_temp.act_as_admin();
  assert (select current_target from public.qr_codes
          where id = 'bbbbbbbb-0000-0000-0000-000000000002')
    = 'https://bob.example/menu', 'ปลายทางของบ๊อบต้องไม่ถูกแตะ';
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. constraint บังคับ business invariant
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  blocked boolean;
begin
  perform pg_temp.act_as_admin();

  -- static ห้ามมี shortcode (invariant ข้อ 1)
  blocked := false;
  begin
    insert into public.qr_codes (owner_id, kind, qr_type, content, shortcode, current_target)
    values (alice, 'static', 'url', '{}'::jsonb, 'zzzzzzz', 'https://x.example');
  exception when check_violation then blocked := true;
  end;
  assert blocked, 'static QR ต้องมี shortcode ไม่ได้';

  -- dynamic ต้องมี shortcode
  blocked := false;
  begin
    insert into public.qr_codes (owner_id, kind, qr_type, content)
    values (alice, 'dynamic', 'url', '{}'::jsonb);
  exception when check_violation then blocked := true;
  end;
  assert blocked, 'dynamic QR ต้องมี shortcode เสมอ';

  -- พร้อมเพย์เป็น dynamic ไม่ได้ เพราะแอปธนาคารอ่าน payload ตรง
  blocked := false;
  begin
    insert into public.qr_codes (owner_id, kind, qr_type, content, shortcode, current_target)
    values (alice, 'dynamic', 'promptpay', '{}'::jsonb, 'ppppppp', 'https://x.example');
  exception when check_violation then blocked := true;
  end;
  assert blocked, 'พร้อมเพย์ต้องเป็น dynamic ไม่ได้';

  -- WiFi ก็เช่นกัน
  blocked := false;
  begin
    insert into public.qr_codes (owner_id, kind, qr_type, content, shortcode, current_target)
    values (alice, 'dynamic', 'wifi', '{}'::jsonb, 'wwwwwww', 'https://x.example');
  exception when check_violation then blocked := true;
  end;
  assert blocked, 'WiFi ต้องเป็น dynamic ไม่ได้';
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. blocklist ปฏิเสธ shortcode ที่มีคำต้องห้าม
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  blocked boolean := false;
begin
  perform pg_temp.act_as_admin();
  begin
    insert into public.qr_codes (owner_id, kind, qr_type, content, shortcode, current_target)
    values (alice, 'dynamic', 'url', '{}'::jsonb, 'asexbcd', 'https://x.example');
  exception when check_violation then blocked := true;
  end;
  assert blocked, 'shortcode ที่มีคำต้องห้ามต้องถูกปฏิเสธ';
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. shortcode ซ้ำถูกปฏิเสธ — เป็นข้อสมมติที่โค้ดบันทึก QR พึ่งอยู่
--     saveQr สุ่ม shortcode แล้วเขียนเลย ไม่เช็คก่อน ถ้าชนก็สุ่มใหม่
--     ถ้า unique constraint หายไป จะมี QR สองอันชี้ shortcode เดียวกันเงียบ ๆ
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  blocked boolean := false;
begin
  perform pg_temp.act_as(alice);
  begin
    insert into public.qr_codes (owner_id, kind, qr_type, content, shortcode, current_target)
    values (alice, 'dynamic', 'url', '{}'::jsonb, 'a2c4e6g', 'https://x.example');
  exception when unique_violation then blocked := true;
  end;
  assert blocked, 'shortcode ซ้ำต้องถูกปฏิเสธด้วย unique constraint';
  perform pg_temp.act_as_admin();
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. ผู้ใช้ที่ล็อกอินสร้าง dynamic QR ของตัวเองได้ (เส้นทางของ saveQr)
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  new_id uuid;
  version int;
begin
  perform pg_temp.act_as(alice);

  insert into public.qr_codes (owner_id, kind, title, qr_type, content, shortcode, current_target)
  values (alice, 'dynamic', 'ของใหม่', 'url',
          '{"type":"url","url":"https://alice.example/new"}'::jsonb,
          'n3w4c5d', 'https://alice.example/new')
  returning id into new_id;

  assert new_id is not null, 'เจ้าของต้องสร้าง dynamic QR ของตัวเองได้';

  version := public.set_qr_target(new_id, 'https://alice.example/new');
  assert version = 1, 'บันทึกเวอร์ชันแรกได้ทันทีหลังสร้าง';

  perform pg_temp.act_as_admin();
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. ตารางฝั่งเงิน — ไม่มีใครนอกจาก service_role แตะ webhook_events ได้
--
-- ตารางนี้เก็บ body ดิบของทุกเหตุการณ์จาก gateway ซึ่งมีข้อมูลการจ่ายเงินของลูกค้า
-- ถ้ารั่วออกไปฝั่ง client แม้แต่แถวเดียวก็ถือว่าพัง
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  blocked boolean := false;
begin
  insert into public.webhook_events (gateway, event_id, event_key, raw_body)
  values ('opn', 'evnt_rls_1', 'charge.complete', '{}');

  perform pg_temp.act_as_anon();
  begin
    perform count(*) from public.webhook_events;
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked, 'anon ต้องอ่าน webhook_events ไม่ได้';

  blocked := false;
  perform pg_temp.act_as(alice);
  begin
    perform count(*) from public.webhook_events;
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked, 'ผู้ใช้ที่ล็อกอินก็ต้องอ่าน webhook_events ไม่ได้';

  blocked := false;
  begin
    insert into public.webhook_events (gateway, event_id, event_key, raw_body)
    values ('opn', 'evnt_rls_2', 'charge.complete', '{}');
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked, 'ผู้ใช้ที่ล็อกอินต้องปลอมเหตุการณ์การจ่ายเงินไม่ได้';

  perform pg_temp.act_as_admin();
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. payments — เจ้าของอ่านของตัวเองได้ แต่แก้ไม่ได้
--
-- ต้องอ่านได้เพื่อทำหน้าประวัติการจ่ายเงิน แต่ถ้าเขียนได้ด้วย
-- ผู้ใช้จะสร้างรายการจ่ายเงินปลอมแล้วอ้างสิทธิ์ได้
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  bob   uuid := '22222222-2222-2222-2222-222222222222';
  visible integer;
  blocked boolean := false;
begin
  insert into public.payments
    (owner_id, gateway, gateway_charge_id, price_code, amount_satang, status)
  values
    (alice, 'opn', 'chrg_rls_alice', 'pro_monthly', 14900, 'successful'),
    (bob,   'opn', 'chrg_rls_bob',   'pro_monthly', 14900, 'successful');

  perform pg_temp.act_as(alice);

  select count(*) into visible from public.payments;
  assert visible = 1, format('อลิซควรเห็นรายการจ่ายเงิน 1 รายการ แต่เห็น %s', visible);

  select count(*) into visible from public.payments where owner_id <> alice;
  assert visible = 0, 'อลิซต้องไม่เห็นรายการจ่ายเงินของคนอื่น';

  begin
    insert into public.payments
      (owner_id, gateway, gateway_charge_id, price_code, amount_satang, status)
    values (alice, 'opn', 'chrg_rls_fake', 'pro_lifetime', 390000, 'successful');
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked, 'ผู้ใช้ต้องสร้างรายการจ่ายเงินปลอมไม่ได้';

  blocked := false;
  perform pg_temp.act_as_anon();
  begin
    perform count(*) from public.payments;
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked, 'anon ต้องอ่าน payments ไม่ได้เลย';

  perform pg_temp.act_as_admin();
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. ผู้ใช้ต้องเรียก function ของงานลดระดับเองไม่ได้
--
-- restore_suspended_qr_codes เป็น security definer ถ้าใครเรียกได้เอง
-- ก็แปลว่าปลดล็อก QR ที่ถูกพักคืนได้โดยไม่ต้องจ่ายเงิน
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  blocked boolean := false;
begin
  perform pg_temp.act_as(alice);

  begin
    perform public.restore_suspended_qr_codes(alice);
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked, 'ผู้ใช้ต้องปลดล็อก QR ที่ถูกพักเองไม่ได้';

  blocked := false;
  begin
    perform public.run_downgrade_sweep();
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked, 'ผู้ใช้ต้องสั่งงานกวาดรายวันเองไม่ได้';

  perform pg_temp.act_as_anon();

  blocked := false;
  begin
    perform public.restore_suspended_qr_codes(alice);
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked, 'anon ต้องปลดล็อก QR ที่ถูกพักไม่ได้';

  perform pg_temp.act_as_admin();
end;
$$;

-- ---------------------------------------------------------------------------
-- 16. เจ้าของแก้สถานะ QR ของตัวเองเป็น active เองไม่ได้ถ้าถูกพักอยู่
--
-- นี่คือช่องที่ชัดที่สุดที่จะเลี่ยงการจ่ายเงิน: ถูกพักแล้วก็แค่ update กลับเอง
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  qr uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  blocked boolean := false;
  still text;
begin
  update public.qr_codes
  set status = 'suspended', suspended_at = now()
  where id = qr;

  perform pg_temp.act_as(alice);

  -- ยิง update ตรง ๆ ต้องไม่ผ่านตั้งแต่ชั้นสิทธิ์คอลัมน์
  begin
    update public.qr_codes set status = 'active' where id = qr;
    assert false, 'เจ้าของต้อง update คอลัมน์ status ตรง ๆ ไม่ได้';
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked;

  -- เรียกผ่าน function ที่ถูกต้องก็ยังต้องถูกปฏิเสธ
  blocked := false;
  begin
    perform public.set_qr_status(qr, 'active');
    assert false, 'set_qr_status ต้องไม่ปลดสถานะ suspended ให้';
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked;

  perform pg_temp.act_as_admin();
  select status into still from public.qr_codes where id = qr;
  assert still = 'suspended',
    format('QR ต้องยังถูกพักอยู่ แต่กลายเป็น %s', still);

  -- แต่การเก็บเข้าคลังตามปกติต้องยังทำได้
  update public.qr_codes set status = 'active', suspended_at = null where id = qr;

  perform pg_temp.act_as(alice);
  perform public.set_qr_status(qr, 'archived');
  perform pg_temp.act_as_admin();

  select status into still from public.qr_codes where id = qr;
  assert still = 'archived', 'เจ้าของต้องเก็บ QR เข้าคลังเองได้';

  -- และเปลี่ยนเป็นสถานะที่ไม่ได้ตั้งใจเปิดให้ ต้องไม่ได้
  blocked := false;
  perform pg_temp.act_as(alice);
  begin
    perform public.set_qr_status(qr, 'suspended');
    assert false, 'เจ้าของต้องตั้งสถานะ suspended เองไม่ได้';
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked;

  -- และแตะ QR ของคนอื่นไม่ได้
  blocked := false;
  begin
    perform public.set_qr_status('bbbbbbbb-0000-0000-0000-000000000002', 'archived');
    assert false, 'เจ้าของต้องเปลี่ยนสถานะ QR ของคนอื่นไม่ได้';
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked;

  perform pg_temp.act_as_admin();
end;
$$;

-- ---------------------------------------------------------------------------
-- 17. เจ้าของยังเปลี่ยนชื่อ QR เองได้ตามปกติ (กันการปิดสิทธิ์เกินจำเป็น)
-- ---------------------------------------------------------------------------

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  qr uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  blocked boolean := false;
begin
  perform pg_temp.act_as(alice);

  update public.qr_codes set title = 'ชื่อใหม่' where id = qr;
  assert (select title from public.qr_codes where id = qr) = 'ชื่อใหม่',
    'เจ้าของต้องเปลี่ยนชื่อ QR ของตัวเองได้';

  -- แต่ย้ายเจ้าของไม่ได้
  begin
    update public.qr_codes
    set owner_id = '22222222-2222-2222-2222-222222222222'
    where id = qr;
    assert false, 'เจ้าของต้องโอน QR ให้คนอื่นเองไม่ได้';
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked;

  perform pg_temp.act_as_admin();
end;
$$;

\echo 'RLS และ constraint ผ่านทั้งหมด'

rollback;
