-- ---------------------------------------------------------------------------
-- shop_pages — หน้าร้านหน้าเดียวหลัง QR (ชื่อร้าน คำอธิบาย ลิงก์ เบอร์ เวลาเปิดปิด)
--
-- แพ็กเกจ Pro เท่านั้น เพราะเป็นของที่เราต้องโฮสต์และดูแลต่อ (strategy.md §4)
-- หนึ่งบัญชีหนึ่งหน้า — ร้านหนึ่งร้านมีหน้าร้านเดียว
-- ไม่มีรูปภาพโดยตั้งใจ จึงไม่ต้องพึ่งระบบเก็บไฟล์
-- ---------------------------------------------------------------------------
create table public.shop_pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  phone text not null default '' check (char_length(phone) <= 20),
  hours text not null default '' check (char_length(hours) <= 120),
  links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shop_pages_touch
  before update on public.shop_pages
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- สิทธิ์
--
-- เจ้าของอ่านหน้าของตัวเองได้ แต่ "เขียนไม่ได้" — การเขียนทำผ่าน server action
-- ด้วย service role หลังเช็คว่าเป็น Pro ถ้าให้เขียนตรง ๆ คนแพ็กเกจฟรีจะยิง
-- PostgREST ด้วย JWT ตัวเองแล้วสร้างหน้าได้โดยไม่ต้องจ่าย
-- ---------------------------------------------------------------------------
alter table public.shop_pages enable row level security;

grant select on public.shop_pages to authenticated;
grant select, insert, update, delete on public.shop_pages to service_role;

create policy shop_pages_select_own on public.shop_pages
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- คนทั่วไปเห็นเฉพาะช่องที่เป็นสาธารณะ ไม่เห็น owner_id
create function public.shop_page_by_slug(p_slug text)
returns table (name text, description text, phone text, hours text, links jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select name, description, phone, hours, links
  from public.shop_pages
  where slug = p_slug;
$$;

revoke all on function public.shop_page_by_slug(text) from public;
grant execute on function public.shop_page_by_slug(text) to anon, authenticated;
