# ADR 0002 — ชื่อแบรนด์และโดเมนเป็น placeholder ผ่าน env

- **สถานะ:** 🟡 ปิดครึ่งเดียว — ชื่อล็อกแล้วเป็น **QR Cute** (14 ก.ย. 2026) แต่ยังไม่ได้ซื้อโดเมน
- **วันที่:** 22 ส.ค. 2026 (ยอมรับ) · 14 ก.ย. 2026 (ล็อกชื่อ)

## บริบท

ยังไม่ได้ตัดสินใจชื่อแบรนด์และยังไม่ได้ซื้อโดเมน แต่ต้องเริ่มเขียนโค้ดวันนี้
ชื่อแบรนด์และโดเมนโผล่ในหลายที่ที่แก้ทีหลังแล้วพลาดง่าย: `metadata`, canonical, `og:image`,
`sitemap.xml`, JSON-LD `Organization`, footer, อีเมล support

การ hardcode แล้วมา find-replace ทีหลังคือวิธีที่พลาดแน่นอน — จะเหลือค้างในที่ที่ลืม
โดยเฉพาะใน JSON-LD และ sitemap ซึ่งเป็นจุดที่ SEO พังเงียบ ๆ โดยไม่มีใครเห็น

## การตัดสินใจ

ค่าทั้งหมดอ่านจาก `src/lib/site.ts` ซึ่งอ่านต่อจาก env:

```
NEXT_PUBLIC_SITE_NAME       ชื่อที่แสดงผล  (default: "QR Cute")
NEXT_PUBLIC_SITE_SHORT_NAME ชื่อสั้น        (default: "QRCute")
NEXT_PUBLIC_SITE_URL        origin         (default: "http://localhost:3000")
```

**กฎ:** ห้าม hardcode ชื่อแบรนด์หรือโดเมนที่ไหนก็ตามนอก `src/lib/site.ts`
URL ทุกอันที่ต้องเป็น absolute ให้สร้างผ่าน `absoluteUrl()` ไม่ใช่ต่อสตริงเอง

## ผลที่ตามมา

- เปลี่ยนชื่อแบรนด์ = แก้ env แล้ว redeploy ไม่ต้องแตะโค้ด
- 🧪 มี test ใน `src/lib/site.test.ts` กัน regression
- ข้อเสีย: ชื่อ placeholder อาจหลุดขึ้น production ถ้าลืมตั้ง env
  → ก่อน deploy จริงครั้งแรกต้องเช็คว่า `NEXT_PUBLIC_SITE_URL` ไม่ใช่ localhost

## ต้องทำอะไรเพื่อปิด ADR นี้

1. [x] ตัดสินใจชื่อแบรนด์ — **QR Cute** (14 ก.ย. 2026)
2. [x] แก้ default ใน `src/lib/site.ts` ให้เป็นค่าจริง
3. [ ] 🔴 **ซื้อโดเมน** — เลยกำหนด 25 ส.ค. มาแล้ว และยังบล็อกนาฬิกา SEO
       กับการสมัคร Opn อยู่ (ดู `docs/decisions/0007-payment-gateway.md`)
4. [ ] ตั้ง env จริงบน Vercel แล้วแก้ default ของ `url`
5. [ ] เปลี่ยนสถานะ ADR นี้เป็น "แทนที่แล้ว"

## กันโดเมน placeholder หลุดขึ้น production

ข้อเสียที่เขียนไว้ข้างบนว่า "ชื่อ placeholder อาจหลุดขึ้น production" ตอนนี้มีตัวกันแล้ว:
`assertUrlConfigured()` ใน `src/lib/site.ts` จะโยน error ถ้า `VERCEL_ENV=production`
แต่ `NEXT_PUBLIC_SITE_URL` ยังเป็น localhost

เช็คด้วย `VERCEL_ENV` ไม่ใช่ `NODE_ENV` เพราะ `bun run build` ในเครื่องก็นับเป็น production
ถ้าใช้ `NODE_ENV` จะ build ในเครื่องไม่ได้เลยตั้งแต่ยังไม่มีโดเมน
