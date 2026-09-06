# ADR 0004 — โครงข้อมูลของ Dynamic QR

- **สถานะ:** 🟡 รออนุมัติ (ห้ามเขียนโค้ดจนกว่าจะอนุมัติ — [docs/prd.md](../prd.md) §4.1)
- **วันที่:** 6 ก.ย. 2026

## บริบท

Phase 3 เพิ่มบัญชีผู้ใช้และ dynamic QR ซึ่งเปลี่ยนโปรเจกต์จาก "เครื่องมือฝั่ง client ล้วน"
เป็น "บริการที่มีสถานะ" การออกแบบตารางผิดตอนนี้แก้ยากมาก เพราะ:

1. **shortcode ถูกพิมพ์ลงป้ายจริง** — เปลี่ยนรูปแบบทีหลัง = QR ที่ลูกค้าพิมพ์ไปแล้วตายทั้งหมด
2. **scan event เก็บแล้วเก็บเลย** — เก็บเกินแล้วมาลบทีหลังไม่ช่วยเรื่อง PDPA
3. **RLS เป็นชั้นกันข้อมูลรั่วชั้นเดียวที่มี** — เจ้าของโปรเจกต์ทำคนเดียว ไม่มี code review

## ข้อจำกัดที่มาก่อนทุกอย่าง

**Business invariant ข้อ 1:** static QR ต้องชี้ปลายทางตรงเสมอ ห้ามวิ่งผ่าน `/r/`

แปลว่าตารางต้องแยกให้ชัดว่า QR ไหน "แค่บันทึกดีไซน์ไว้" กับ QR ไหน "วิ่งผ่านเรา"
และต้องมี constraint ระดับ database บังคับ ไม่ใช่แค่ความตั้งใจในโค้ด

## ⚠️ ข้อจำกัดของ product ที่ต้องยอมรับ

**Dynamic QR ใช้ได้กับปลายทางที่เป็น URL เท่านั้น**

เพราะ QR แบบ dynamic เก็บลิงก์ `https://โดเมนเรา/r/xxxxx` ไว้ข้างใน แล้วให้เครื่องอ่าน
เปิดลิงก์นั้นก่อน — จึงใช้ไม่ได้กับ:

| ประเภท | dynamic ได้ไหม | เหตุผล |
| --- | :--: | --- |
| ลิงก์เว็บไซต์ | ✅ | เป็น URL อยู่แล้ว |
| LINE OA | ✅ | เป็น URL |
| **พร้อมเพย์** | ❌ | แอปธนาคารอ่าน payload EMVCo ตรง ๆ ไม่ได้เปิด URL |
| WiFi | ❌ | มือถือต้องอ่านสตริง `WIFI:` เพื่อเชื่อมต่อ |
| นามบัตร | ❌ | มือถือต้องอ่าน vCard เพื่อบันทึกรายชื่อ |

**นี่กระทบการขาย** — [strategy.md](../strategy.md) วางให้ dynamic QR เป็นของขายหลักของ Pro
แต่ประเภทที่ขายดีที่สุดของเรา (พร้อมเพย์) เป็น dynamic ไม่ได้เลย
ต้องสื่อสารให้ชัดตั้งแต่หน้า pricing ไม่ใช่ให้ลูกค้ามารู้ทีหลัง

---

## ER diagram

```
┌──────────────────────────┐
│ auth.users               │  (Supabase จัดการเอง)
└───────────┬──────────────┘
            │ 1:1
┌───────────▼──────────────┐
│ profiles                 │
│──────────────────────────│
│ id            uuid  PK FK│───┐
│ display_name  text       │   │
│ created_at    timestamptz│   │
└──────────────────────────┘   │
                               │ 1:N
        ┌──────────────────────┼───────────────────────┬────────────────────┐
        │                      │                       │                    │
┌───────▼──────────────────┐   │        ┌──────────────▼──────┐  ┌──────────▼─────────┐
│ qr_codes                 │   │        │ subscriptions       │  │ entitlements       │
│──────────────────────────│   │        │─────────────────────│  │────────────────────│
│ id             uuid  PK  │   │        │ id          uuid PK │  │ id        uuid PK  │
│ owner_id       uuid  FK  │───┘        │ owner_id    uuid FK │  │ owner_id  uuid FK  │
│ kind           text      │            │ plan        text    │  │ feature   text     │
│   'static'|'dynamic'     │            │ billing_kind text   │  │ quota     int NULL │
│ title          text      │            │ status      text    │  │ source    text     │
│ qr_type        text      │            │ period_end  tstz    │  │ expires_at tstz    │
│ content        jsonb     │            │ grace_until tstz    │  │ UNIQUE(owner,feat) │
│ style          jsonb     │            │ gateway_*   text    │  └────────────────────┘
│ shortcode      text  UQ  │            │ UNIQUE(owner_id)    │
│ current_target text      │            └─────────────────────┘
│ status         text      │
│ created_at     tstz      │
│ updated_at     tstz      │
└────┬─────────────────┬───┘
     │ 1:N             │ 1:N
┌────▼──────────────┐ ┌▼────────────────────────┐
│ qr_versions       │ │ scans                   │
│───────────────────│ │─────────────────────────│
│ id       uuid PK  │ │ id          bigint PK   │
│ qr_code_id uuid FK│ │ qr_code_id  uuid   FK   │
│ version  int      │ │ scanned_at  tstz        │
│ target_url text   │ │ country     text        │
│ created_by uuid FK│ │ region      text        │
│ created_at tstz   │ │ device_type text        │
│ UNIQUE(qr,version)│ │ referrer_host text      │
└───────────────────┘ │ ip_hash     bytea       │
                      └─────────────────────────┘
```

---

## การตัดสินใจสำคัญ

### 1. static กับ dynamic อยู่ตารางเดียวกัน แต่มี constraint บังคับ

เก็บ static QR ไว้ในบัญชีได้ **เพื่อให้กลับมาแก้ดีไซน์และโหลดไฟล์ใหม่** แต่ตัว QR
ยังฝัง payload ตรงเสมอ — `shortcode` และ `current_target` ต้องเป็น NULL เมื่อ kind='static'

```sql
constraint dynamic_needs_shortcode
  check ((kind = 'dynamic') = (shortcode is not null)),
constraint dynamic_needs_target
  check ((kind = 'dynamic') = (current_target is not null)),
constraint dynamic_is_url_only
  check (kind = 'static' or qr_type in ('url', 'line'))
```

ข้อสุดท้ายบังคับข้อจำกัดของ product ที่ระดับ database — ไม่มีทางเผลอสร้าง
dynamic พร้อมเพย์ได้เลยแม้โค้ดจะบั๊ก

### 2. เก็บปลายทางปัจจุบันซ้ำไว้บน `qr_codes`

`qr_versions` เก็บประวัติครบ แต่การ redirect ต้องอ่านครั้งเดียวจบเพื่อให้ทัน p95 < 100ms
ถ้าให้ redirect ไปหา "เวอร์ชันล่าสุด" จาก `qr_versions` ทุกครั้งจะต้อง sort ทุกคำขอ

ยอมเก็บซ้ำ แลกกับความเร็ว โดยให้การเขียนทั้งสองที่อยู่ใน transaction เดียว

### 3. `scans` ใช้ bigint identity ไม่ใช่ uuid

เป็นตารางที่โตเร็วที่สุดในระบบ uuid กิน 16 byte และทำให้ index กระจัดกระจาย
bigint เรียงตามเวลาเขียนจึงเหมาะกับ append-only
เตรียมแบ่ง partition รายเดือนไว้เมื่อเกิน ~10 ล้านแถว (ยังไม่ทำตอนนี้)

### 4. `entitlements` เป็นตารางจริง ไม่ใช่ค่าที่คำนวณจาก subscription

[prd.md](../prd.md) §5.1 บังคับว่าโค้ดที่เช็คสิทธิ์ต้องไม่รู้จัก payment gateway
และ [strategy.md](../strategy.md) บอกว่าจะขาย B2B แบบ manual ก่อน — ต้องแจกสิทธิ์ด้วยมือได้
ตารางนี้จึงมี `source` แยกว่าสิทธิ์มาจากแพ็กเกจหรือให้เอง

`hasFeature()` และ `getQuota()` อ่านตารางนี้ที่เดียว ไม่แตะ `subscriptions` เลย

### 5. RLS ปิดทุกตาราง — redirect ใช้ function แทนการเปิดอ่าน

ถ้าเปิดให้ anon อ่าน `qr_codes` เพื่อ redirect จะเท่ากับเปิดให้ใครก็ได้ไล่ดู
ปลายทางของลูกค้าทุกคน จึงใช้ function ที่คืนเฉพาะสิ่งที่จำเป็น:

```sql
create function public.resolve_shortcode(code text)
returns text
language sql
security definer
set search_path = public
as $$
  select current_target from qr_codes
  where shortcode = code and status = 'active' and kind = 'dynamic'
$$;
```

| ตาราง | anon | เจ้าของ | หมายเหตุ |
| --- | --- | --- | --- |
| `profiles` | ✗ | อ่าน/แก้ของตัวเอง | |
| `qr_codes` | ✗ | CRUD ของตัวเอง | redirect ผ่าน function เท่านั้น |
| `qr_versions` | ✗ | อ่านของ QR ตัวเอง | เขียนผ่าน function |
| `scans` | ✗ | อ่านของ QR ตัวเอง | เขียนผ่าน function |
| `subscriptions` | ✗ | อ่านอย่างเดียว | webhook เขียนด้วย service role |
| `entitlements` | ✗ | อ่านอย่างเดียว | ระบบเขียนเท่านั้น |

### 6. Draft ของผู้ใช้ที่ยังไม่สมัคร ไม่มีตารางฝั่ง server

[prd.md](../prd.md) §4.2 ต้องการให้ claim QR ที่สร้างตอนไม่ล็อกอินได้
ทำด้วย localStorage แล้วส่งขึ้นมาตอนสมัคร — ไม่เก็บอะไรบน server ก่อนผู้ใช้ยินยอม
ซึ่งทั้งง่ายกว่าและดีกว่าในแง่ PDPA

---

## SQL ที่เสนอ (ยังไม่รัน)

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table qr_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('static', 'dynamic')),
  title text not null default '',
  qr_type text not null check (qr_type in ('promptpay','url','wifi','line','vcard')),
  content jsonb not null,
  style jsonb not null default '{}'::jsonb,
  shortcode text unique,
  current_target text,
  status text not null default 'active'
    check (status in ('active','archived','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dynamic_needs_shortcode
    check ((kind = 'dynamic') = (shortcode is not null)),
  constraint dynamic_needs_target
    check ((kind = 'dynamic') = (current_target is not null)),
  constraint dynamic_is_url_only
    check (kind = 'static' or qr_type in ('url','line'))
);
create index qr_codes_owner_idx on qr_codes (owner_id, created_at desc);

create table qr_versions (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid not null references qr_codes(id) on delete cascade,
  version int not null,
  target_url text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (qr_code_id, version)
);

create table scans (
  id bigint generated always as identity primary key,
  qr_code_id uuid not null references qr_codes(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  country text,
  region text,
  device_type text check (device_type in ('mobile','tablet','desktop','bot','unknown')),
  referrer_host text,
  ip_hash bytea
);
create index scans_qr_time_idx on scans (qr_code_id, scanned_at desc);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro','business')),
  billing_kind text check (billing_kind in ('monthly','yearly','lifetime')),
  status text not null default 'active'
    check (status in ('active','past_due','grace','canceled')),
  current_period_end timestamptz,
  grace_until timestamptz,
  gateway text,
  gateway_customer_id text,
  gateway_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  feature text not null,
  quota int,
  source text not null default 'plan' check (source in ('plan','manual')),
  expires_at timestamptz,
  unique (owner_id, feature)
);
```

## ผลที่ตามมา

- เพิ่มประเภท QR ใหม่ต้องแก้ `check` constraint สองที่ — ยอมรับได้ แลกกับการที่
  database ปฏิเสธข้อมูลผิดรูปแบบแทนที่จะเชื่อโค้ด
- `style` เก็บเป็น jsonb ทั้งก้อน รวมโลโก้ที่เป็น data URI ซึ่งอาจใหญ่ถึง 1 MB
  → **ต้องย้ายโลโก้ไป Supabase Storage แทน** ก่อนเปิดใช้จริง ไม่งั้นแถวจะบวมมาก
  (เขียนเป็น TODO ไว้ ไม่ทำใน ADR นี้)
- ยังไม่มีตารางสำหรับทีม/seat ตามที่ [strategy.md](../strategy.md) ตัดออกจาก 9 สัปดาห์แรก
