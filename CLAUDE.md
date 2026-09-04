@AGENTS.md

# QR Code Website (ชื่อชั่วคราว: QR ไทย)

เว็บสร้าง QR Code สำหรับตลาดไทย ทำเงินจริงผ่าน freemium + lifetime pack
เจ้าของโปรเจกต์ทำคนเดียว นอกเวลางาน ~10–15 ชม./สัปดาห์ deadline 19 ต.ค. 2026

**เอกสารที่เป็น source of truth — อ่านก่อนเริ่มงานทุกครั้ง**

| ไฟล์ | ใช้ตอบคำถามว่า |
| --- | --- |
| `docs/strategy.md` | ขายใคร ต่างจากคู่แข่งยังไง เก็บเงินยังไง ราคาเท่าไร |
| `docs/prd.md` | ฟีเจอร์ไหนอยู่ tier ไหน acceptance criteria คืออะไร |
| `docs/seo.md` | keyword อะไร URL หน้าตาไหน schema อะไร |
| `docs/roadmap.md` | สัปดาห์นี้ทำอะไร Definition of Done คืออะไร |
| `docs/decisions/` | ทำไมถึงเลือกแบบนี้ (ADR) |

ถ้าคำสั่งขัดกับเอกสารเหล่านี้ ให้บอกความขัดแย้งก่อน แล้วถามว่าจะอัปเดตเอกสารหรือทำเป็นข้อยกเว้น

---

## Business invariants (ห้ามละเมิดเด็ดขาด)

1. **Static QR ต้องชี้ปลายทางโดยตรงเสมอ** — ไม่หมดอายุจริง ห้ามวิ่งผ่าน redirect ของเรา
   ถ้าเห็นโค้ดที่ทำให้ static QR วิ่งผ่าน `/r/` ให้หยุดและแจ้งทันที
2. **สร้าง QR พื้นฐานได้โดยไม่ต้องสมัครสมาชิก** — hero ต้องสร้าง QR ได้ภายใน 5 วินาที
3. **Dynamic QR ต้องบอกผลของการเลิกจ่ายให้ชัดก่อนผู้ใช้สร้าง** ไม่ใช่ตอนจะยกเลิก
4. **หน้า generator ต้องไม่มีโฆษณาอยู่เหนือ fold**
5. **QR canvas ต้องเป็นดำ/ขาวล้วนเสมอ** (`--qr-ink` / `--qr-paper`) ห้ามให้ dark mode พลิกสี QR

---

## กติกาการทำงาน

- อย่าเขียนโค้ดเกินที่สั่ง อย่า refactor ไฟล์ที่ไม่เกี่ยวข้องกับงานปัจจุบัน
- เพิ่ม dependency ใหม่ต้องขออนุญาตพร้อมเหตุผลและทางเลือกที่เทียบแล้วอย่างน้อย 2 ตัว
- การตัดสินใจสถาปัตยกรรมที่ย้อนกลับยาก → เขียน ADR ใน `docs/decisions/` ก่อนลงมือ
- **ห้ามเดาสเปกภายนอก** (EMVCo/PromptPay, payment gateway API, Safe Browsing API)
  ถ้าไม่มั่นใจให้หยุดถาม แล้วเว้น `TODO` ไว้ อย่าเขียนโค้ดที่เดาแล้วดูเหมือนถูก
- ทุก feature ต้องมี test อย่างน้อย happy path + 1 edge case
- ตอบภาษาไทย ศัพท์เทคนิคคงภาษาอังกฤษ
- ถ้าเห็นว่าคำสั่งทำให้ product แย่ลง ให้ค้านก่อนทำ

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · shadcn/ui (new-york)
Biome (lint + format) · Vitest + Testing Library · Bun · Supabase (จาก W4) · Vercel

> Next.js 16 ใหม่กว่าที่โมเดลเคยเห็นตอนเทรน — ก่อนเขียน API ของ Next
> ให้อ่าน `node_modules/next/dist/docs/` ก่อนเสมอ (ดู `AGENTS.md`)

## คำสั่งที่ใช้บ่อย

```bash
bun run dev         # dev server
bun run check       # typecheck + lint + test — รันก่อน commit ทุกครั้ง
bun run test        # vitest run
bun run test:watch  # vitest watch
bun run lint:fix    # biome check --write
bun run build       # production build
```

## โครงไฟล์

```
src/
  app/                 App Router — หน้าเว็บทั้งหมด
  components/ui/       shadcn/ui primitives (ห้ามแก้ด้วยมือถ้าไม่จำเป็น)
  components/          component ของโปรเจกต์
  lib/                 logic ที่ test ได้ ไม่ผูกกับ React
docs/                  เอกสารด้านบน
```

## Convention

- **แยก logic ออกจาก React** — encode/decode payload, CRC, validation อยู่ใน `src/lib/`
  และต้อง test ได้โดยไม่ต้อง render component
- Component ใน `src/components/` เป็น presentational เป็นหลัก รับ props ไม่ยิง fetch เอง
- ใช้ Server Component เป็นค่าเริ่มต้น ใส่ `"use client"` เฉพาะที่ต้อง interactive จริง
- **หน้า generator ต้องเป็น client-side ทั้งหมด** ห้ามยิง API เพื่อสร้าง QR
- ชื่อแบรนด์/โดเมนต้องอ่านจาก `src/lib/site.ts` ห้าม hardcode
- ข้อความไทยในหน้า public ใช้ `text-thai` หรืออยู่ใน element ที่ `lang="th"`
  เพื่อให้ตัดบรรทัดถูก (ดู `src/app/globals.css`)
- a11y: ทุก flow ต้องใช้คีย์บอร์ดล้วนได้ครบ และมี `aria-label` ภาษาไทย
