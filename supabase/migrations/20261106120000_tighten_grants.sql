-- ปิดสิทธิ์ที่ Supabase cloud แจกให้ตารางใหม่อัตโนมัติ
--
-- init.sql revoke สิทธิ์ของตารางที่มีอยู่ตอนนั้นครั้งเดียว ตารางที่สร้างทีหลังจึงได้
-- default privileges ของ cloud ซึ่งให้ anon/authenticated ทุกสิทธิ์ (local ไม่ให้ จึงไม่เคยเห็น)
-- RLS ยังกั้นแถวอยู่ แต่ TRUNCATE ไม่ผ่าน RLS และโปรเจกต์นี้ตั้งใจให้ grant เป็นด่านแรก
-- เจอตอน deploy ครั้งแรก 6 พ.ย. 2026 — supabase/tests/rls.sql จับได้

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke all on public.webhook_events, public.payments, public.checkout_sessions, public.shop_pages
  from anon, authenticated;

-- คืนเฉพาะสิทธิ์ที่ migration ต้นทางตั้งใจให้
grant select on public.payments to authenticated;
grant select on public.checkout_sessions to authenticated;
grant select on public.shop_pages to authenticated;
