# ADR 0001 — เลือก stack

- **สถานะ:** ยอมรับแล้ว
- **วันที่:** 22 ส.ค. 2026

## บริบท

เว็บสร้าง QR Code สำหรับตลาดไทย ทำคนเดียว ~10–15 ชม./สัปดาห์ deadline 9 สัปดาห์
ข้อจำกัดที่กำหนดการเลือก:

1. **SEO คือช่องทางหาลูกค้าเดียว** → ต้อง SSG/ISR ได้ดี และคุม Core Web Vitals ได้
2. **QR ต้อง render ฝั่ง client** → ต้องมี client component ที่ interactive เต็มรูปแบบบนหน้าเดียวกับเนื้อหา SSG
3. **งบเริ่มต้นต่ำ** → ต้องอยู่บน free tier ได้จนกว่าจะมีรายได้
4. **คนเดียว** → เวลาที่เสียไปกับ infra คือเวลาที่ไม่ได้ทำฟีเจอร์

## การตัดสินใจ

| ชั้น | เลือก | เวอร์ชันที่ติดตั้งจริง |
| --- | --- | --- |
| Framework | Next.js App Router | 16.3.2 |
| UI runtime | React | 19.2.8 |
| ภาษา | TypeScript strict | 5.9.3 |
| CSS | Tailwind CSS | 4.3.3 |
| Component | shadcn/ui (new-york) | ติดตั้งเป็นซอร์สในโปรเจกต์ |
| Lint + Format | Biome | 2.4.2 |
| Test | Vitest + Testing Library | 4.1.11 |
| Runtime/PM | Bun | 1.3.14 |
| Backend | Supabase (จาก W5) | ยังไม่ติดตั้ง |
| Hosting | Vercel | — |

## เหตุผล

**Next.js App Router** — ข้อจำกัดข้อ 1 และ 2 ขัดกันในเฟรมเวิร์กส่วนใหญ่: เว็บที่ SEO ดีมักเป็น
static ล้วน ส่วนเว็บที่ interactive ดีมักเป็น SPA ที่ SEO แย่ App Router แก้ได้ตรง ๆ ด้วย
Server Component สำหรับเนื้อหา + `"use client"` เฉพาะตัว generator บนหน้าเดียวกัน
บวกกับ `next/font` ที่กัน CLS จากฟอนต์ไทย และ `next/og` สำหรับ og:image แบบ dynamic

**Tailwind v4 + shadcn/ui** — shadcn ให้ซอร์สโค้ดมาอยู่ในโปรเจกต์ ไม่ใช่ dependency
แก้ได้ตามใจโดยไม่ต้องสู้กับ API ของไลบรารี ซึ่งสำคัญมากเพราะ UI ของเรามีของแปลก
(QR canvas ที่ห้าม theme, frame ภาษาไทย, print preview) และไม่เพิ่ม bundle ที่ไม่ได้ใช้

**Biome แทน ESLint + Prettier** — ตัวเดียวจบ เร็วกว่ามาก และ config น้อยกว่า
สำหรับคนเดียวที่มีเวลาจำกัด เวลาที่ประหยัดจากการไม่ต้อง tune eslint config คือกำไร
ข้อเสีย: ecosystem ปลั๊กอินเล็กกว่า ESLint — ยอมรับได้เพราะเราไม่ได้ใช้ปลั๊กอินแปลก ๆ

**Vitest แทน Jest** — ใช้ config เดียวกับ Vite แทบไม่ต้องตั้งค่า และเร็วพอที่จะรัน watch
ตลอดเวลาระหว่างทำ PromptPay encoder ซึ่งเป็นงานที่ต้อง test-driven จริง ๆ

**Supabase** — ต้องการ Postgres + auth + RLS ในที่เดียว free tier ใช้เชิงพาณิชย์ได้
และ RLS คือกลไกที่ทำให้ "ผู้ใช้เห็นเฉพาะ QR ของตัวเอง" บังคับที่ชั้น database ไม่ใช่ชั้น app
ซึ่งสำหรับคนเดียวที่ไม่มี code review แปลว่าพลาดยากกว่ามาก

**Bun** — ติดตั้ง dependency เร็วกว่า npm มาก และ Vercel รองรับแล้ว

## ทางเลือกที่พิจารณาแล้วไม่เลือก

| ทางเลือก | ทำไมไม่เลือก |
| --- | --- |
| Astro + island | SEO/perf ดีกว่าเล็กน้อย แต่ dashboard + billing ที่ต้องมาทีหลังจะฝืน และต้องย้ายกลางทาง |
| SvelteKit | เบากว่าและเร็วกว่า แต่ ecosystem shadcn/Supabase/ตัวอย่างน้อยกว่า → เสียเวลาแก้ปัญหาเอง |
| Laravel + Inertia | เจ้าของโปรเจกต์ถนัด แต่ QR generator ต้อง client-side หนัก และ hosting ฟรีคุณภาพดีหายากกว่า Vercel |
| Static ล้วน (Hugo/11ty) | SEO ดีที่สุด แต่ทำ dynamic QR + billing ไม่ได้เลย ต้องเขียนใหม่ทั้งหมดตอน W5 |
| Firebase แทน Supabase | ไม่มี Postgres/RLS · ราคาคาดเดายากเมื่อ scale · vendor lock-in สูงกว่า |
| ESLint + Prettier | config เยอะ ช้ากว่า ไม่คุ้มเวลาสำหรับโปรเจกต์คนเดียว |

## ผลที่ตามมา

**ข้อดี** — SSG/ISR + client interactivity อยู่หน้าเดียวกันได้ · deploy ง่าย · free tier ครอบคลุมจนถึงจุดที่มีรายได้

**ข้อเสียที่ต้องรับ**
- ผูกกับ Vercel พอสมควร (ISR, edge runtime, `next/og`) — ย้ายไป self-host ได้แต่มีงาน
- **Vercel Hobby ห้ามใช้เชิงพาณิชย์** ต้องขึ้น Pro (~$20/เดือน) ก่อนเปิดขาย — ต้องยืนยันเงื่อนไขล่าสุดก่อน launch
- Next.js 16 ใหม่มาก ตัวอย่างและคำตอบบนเน็ตส่วนใหญ่ยังเป็นเวอร์ชันเก่า
  → ต้องอ่าน `node_modules/next/dist/docs/` ก่อนเขียน API ของ Next เสมอ (ระบุไว้ใน `CLAUDE.md`)
- Bun ยัง edge case เยอะกว่า Node บาง library — ถ้าเจอปัญหา fallback เป็น Node ได้
