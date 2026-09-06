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
-- ---------------------------------------------------------------------------

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
-- 6. anon เรียก resolve_shortcode ได้ และได้เฉพาะปลายทาง
-- ---------------------------------------------------------------------------

do $$
begin
  perform pg_temp.act_as_anon();

  assert public.resolve_shortcode('a2c4e6g') = 'https://alice.example/menu',
    'anon ต้อง resolve shortcode ที่ใช้งานอยู่ได้';
  assert public.resolve_shortcode('ไม่มีจริง') is null,
    'shortcode ที่ไม่มีต้องคืน null';

  perform pg_temp.act_as_admin();
  update public.qr_codes set status = 'disabled' where shortcode = 'a2c4e6g';

  perform pg_temp.act_as_anon();
  assert public.resolve_shortcode('a2c4e6g') is null,
    'QR ที่ถูกปิดต้อง resolve ไม่ได้';

  perform pg_temp.act_as_admin();
  update public.qr_codes set status = 'active' where shortcode = 'a2c4e6g';
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

\echo 'RLS และ constraint ผ่านทั้งหมด'

rollback;
