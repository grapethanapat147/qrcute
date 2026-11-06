-- ตั้งสิทธิ์ execute ของทุกฟังก์ชันใน public ให้ตรงกับที่ตั้งใจ
--
-- บน Supabase cloud ฟังก์ชันใหม่ได้ grant execute ให้ anon/authenticated ตรง ๆ
-- "revoke ... from public" ใน migration เดิมจึงไม่มีผล ทำให้ anon เรียก apply_billing_event
-- (ให้แพ็กเกจ) หรือ restore_suspended_qr_codes ผ่าน /rest/v1/rpc ได้ — local ไม่เป็น จึงไม่เคยเห็น
-- เจอตอน deploy ครั้งแรก 6 พ.ย. 2026 ก่อนมีผู้ใช้ — supabase/tests/rls.sql จับได้
--
-- ล้างทุกตัวก่อนแล้วให้ทีละตัวตามรายการ ฟังก์ชันที่ไม่อยู่ในรายการ (trigger) ไม่มีใครเรียกตรงได้

do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      fn
    );
  end loop;
end;
$$;

grant execute on function public.resolve_shortcode(text) to anon, authenticated;
grant execute on function public.record_scan(text, text, text, text, text, bytea)
  to anon, authenticated;
grant execute on function public.shop_page_by_slug(text) to anon, authenticated;

grant execute on function public.set_qr_target(uuid, text) to authenticated;
grant execute on function public.set_qr_status(uuid, text) to authenticated;

grant execute on function public.delete_expired_scans() to service_role;
grant execute on function public.restore_suspended_qr_codes(uuid) to service_role;
grant execute on function public.run_downgrade_sweep() to service_role;
grant execute on function public.apply_billing_event(
  uuid, timestamptz, text, text, text, timestamptz, timestamptz
) to service_role;
