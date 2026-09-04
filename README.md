# QR Code Website (ชื่อชั่วคราว: QR ไทย)

เว็บสร้าง QR Code สำหรับตลาดไทย — พร้อมเพย์ถูกมาตรฐาน ฟอนต์ไทยตัดคำถูก
ฟรีไม่หมดอายุ และอัปเกรดเป็น dynamic QR ได้

## เริ่มต้น

```bash
bun install
cp .env.example .env.local
bun run dev
```

เปิด http://localhost:3000

## คำสั่ง

| คำสั่ง | ทำอะไร |
| --- | --- |
| `bun run dev` | dev server |
| `bun run check` | typecheck + lint + test — **รันก่อน commit ทุกครั้ง** |
| `bun run test` | รัน test ครั้งเดียว |
| `bun run test:watch` | รัน test แบบ watch |
| `bun run lint:fix` | แก้ปัญหา lint/format อัตโนมัติ |
| `bun run build` | production build |

## เอกสาร

| ไฟล์ | เนื้อหา |
| --- | --- |
| [`CLAUDE.md`](./CLAUDE.md) | context + convention สำหรับ coding agent |
| [`docs/strategy.md`](./docs/strategy.md) | ICP · คู่แข่ง · ราคา · ตัวชี้วัด |
| [`docs/prd.md`](./docs/prd.md) | feature spec + acceptance criteria |
| [`docs/seo.md`](./docs/seo.md) | keyword map · URL · schema |
| [`docs/roadmap.md`](./docs/roadmap.md) | แผน 9 สัปดาห์ + Definition of Done |
| [`docs/decisions/`](./docs/decisions/) | ADR |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · shadcn/ui
Biome · Vitest · Bun · Supabase (จาก W5) · Vercel

เหตุผลที่เลือก stack นี้อยู่ใน [ADR 0001](./docs/decisions/0001-stack.md)
