# SEO Plan

สถานะ: ใช้งานจริงบางส่วน · อัปเดตล่าสุด 16 ก.ย. 2026

> ⚠️ **ตัวเลข search volume ในเอกสารนี้ยังไม่ได้ verify** ทุก keyword ต้องเช็คกับ
> Google Keyword Planner หรือ Ahrefs ก่อนล็อกโครงหน้าเว็บ — ถ้าไม่เช็ค เรากำลังเดา

---

## 1. หลักคิด

โดเมนใหม่ไม่มี authority ดังนั้น **อย่าสู้ head keyword ในปีแรก**
คู่แข่ง (qrcode.in.th และเครือ) ครอง "สร้าง qr code" มานาน การไปชนตรง ๆ คือเผาเวลา

กลยุทธ์: **long-tail ที่คู่แข่งไม่ได้ทำหน้าเฉพาะไว้ → สะสม topical authority → ค่อยไต่ขึ้น head**

ลำดับความสำคัญของ cluster:

1. **PromptPay** — มูลค่าสูงสุด ตรงกับสิ่งที่เราทำได้ดีกว่าทุกคน และคู่แข่งต่างชาติทำไม่ได้เลย
2. **Type pages** — volume ดี intent ชัด แปลงเป็นผู้ใช้ได้ทันที
3. **Use case** — competition ต่ำ ตรงกับ ICP ที่จ่ายเงิน
4. **Problem** — สร้าง trust และดึง backlink
5. **Head** — ค่อยไต่ทีหลังเมื่อมี authority

---

## 2. โครงสร้าง URL

```
/                             หน้าแรก + generator          → "สร้าง qr code" (เป้าระยะยาว)
/qr/[type]                    generator แยกประเภท          ← programmatic SEO
    /qr/promptpay             "สร้าง qr code พร้อมเพย์"     ✅ live
    /qr/url                   "แปลงลิงค์เป็น qr code"        ✅ live
    /qr/wifi                  "สร้าง qr code wifi"          ✅ live
    /qr/vcard                 "qr code นามบัตร"             ✅ live
    /qr/line                  "qr code line"                ✅ live
/use-case/[industry]          ✅ live ทั้ง 5 หน้า
    /use-case/restaurant  /use-case/cafe  /use-case/event
    /use-case/clinic      /use-case/online-shop
/blog/[slug]                  how-to + เปรียบเทียบ          ⬜ ยังไม่ทำ (รอเนื้อหาจริง)
/pricing  /about  /terms  /privacy                          ⬜ ยังไม่ทำ
/en/...                       locale ที่สอง (หลัง 19 ต.ค. — ดู ADR 0003)
```

> **แก้เมื่อ 16 ก.ย. 2026:** เอกสารนี้เคยระบุ `/qr/text` `/qr/tel` `/qr/sms` `/qr/email` ไว้ด้วย
> แต่ประเภทเหล่านั้นถูกตัดออกจาก `QR_TYPES` เมื่อ 6 ก.ย. เพราะไม่มีทั้ง keyword cluster
> และ use case ที่สร้างรายได้ จึงไม่ทำหน้าให้ — ตรงกับกฎใน §4 ว่า
> **ถ้าเขียนเนื้อหาเฉพาะตัวให้หน้านั้นไม่ได้ อย่าสร้างหน้านั้น**
>
> ถ้าจะเพิ่มกลับ ต้องเพิ่มใน `src/lib/qr/types.ts` และเขียนเนื้อหาใน
> `src/lib/seo/type-pages.ts` ก่อน หน้าและ sitemap จะโผล่ขึ้นเอง

**กฎ:** URL หน้าไทยไม่มี prefix ภาษา · ห้ามใช้ตัวอักษรไทยใน path (ทำให้ URL ยาวและแชร์ยาก)

---

## 3. Keyword map

| Cluster | ตัวอย่าง keyword | Intent | หน้าเป้าหมาย | ลำดับ |
| --- | --- | --- | --- | :--: |
| **PromptPay** | สร้าง qr พร้อมเพย์, qr code รับเงิน, qr code ร้านค้า, qr พร้อมเพย์ ระบุจำนวนเงิน | Transactional | `/qr/promptpay` | 1 |
| **Type** | qr code wifi, qr code นามบัตร, qr code line, แปลงลิงค์เป็น qr | Transactional | `/qr/[type]` | 2 |
| **Use case** | qr code เมนูอาหาร, qr code ร้านกาแฟ, qr code งานอีเวนต์ | Commercial | `/use-case/[x]` | 3 |
| **Problem** | qr code หมดอายุ, qr code สแกนไม่ติด, qr code พิมพ์แล้วเบลอ | Informational | `/blog/[slug]` | 4 |
| **Comparison** | dynamic qr code คืออะไร, qr code ฟรี vs เสียเงิน | Commercial | `/blog/[slug]` | 4 |
| **Head** | สร้าง qr code, qr code ฟรี, ทํา qr code | Transactional | `/` | 5 |

> หมายเหตุการสะกด: คนไทยพิมพ์ทั้ง "ทำ" และ "ทํา" (ไม้หันอากาศคนละตัว) และทั้ง "คิวอาร์โค้ด"/"qr code"
> ต้องครอบคลุมทั้งสองแบบในเนื้อหา แต่ห้าม keyword stuffing

---

## 4. Programmatic pages — กฎกันโดน doorway penalty

แต่ละหน้า `/qr/[type]` **ต้องมีของจริงเหล่านี้ ไม่ใช่ template ที่เปลี่ยนคำเดียว**:

1. Generator ของประเภทนั้นทำงานได้บนหน้านั้นเลย (ไม่ redirect)
2. Intro ที่อธิบาย use case เฉพาะของประเภทนั้น ≥ 150 คำ เขียนต่างกันจริง
3. ขั้นตอนใช้งานที่มีรายละเอียดเฉพาะประเภท (WiFi พูดถึง WPA2/ซ่อน SSID, vCard พูดถึงฟิลด์)
4. ตัวอย่างจริงพร้อมภาพ
5. FAQ 5 ข้อที่ไม่ซ้ำกับหน้าอื่น
6. Related links ไปหน้าที่เกี่ยวข้องจริง

**เกณฑ์ตัดสินใจ:** ถ้าเขียนเนื้อหาเฉพาะตัวให้หน้านั้นไม่ได้ **อย่าสร้างหน้านั้น**
10 หน้าที่ดีชนะ 40 หน้าที่จืด

---

## 5. Technical SEO

### ต้องมีตั้งแต่วันแรก

- [x] SSG ทุกหน้า marketing · generator เป็น client component ที่ hydrate เร็ว
- [x] `sitemap.xml` (`src/app/sitemap.ts` — ดึงรายการจากแหล่งเดียวกับหน้าเว็บ)
- [x] `robots.txt` (`src/app/robots.ts`) · canonical ทุกหน้า
- [x] `hreflang` th + x-default ทุกหน้า (ADR 0003 — เพิ่ม en เมื่อมีหน้าจริง)
- [x] `og:image` แบบ dynamic ผ่าน `next/og` พร้อมฟอนต์ไทย subset
      ⚠️ ถ้าโหลดฟอนต์ไม่ได้จะเรนเดอร์เฉพาะอักษรละติน ไม่ปล่อยให้เป็นกล่องสี่เหลี่ยม
- Core Web Vitals ตามเกณฑ์ใน `docs/prd.md` §0 วัดจริงด้วย Vercel Speed Insights
- ไม่มี CLS จากฟอนต์ — ใช้ `next/font` พร้อม `display: swap` และ fallback metric

### JSON-LD

| Schema | ใช้ที่ |
| --- | --- |
| `SoftwareApplication` | `/` และ `/qr/[type]` |
| `FAQPage` | ทุกหน้าที่มี FAQ |
| `HowTo` | หน้าที่มีขั้นตอนการใช้งาน |
| `BreadcrumbList` | ทุกหน้าที่ไม่ใช่หน้าแรก |
| `Article` | `/blog/[slug]` |
| `Organization` | `/` |

validate ด้วย Rich Results Test ทุกครั้งก่อน deploy หน้าใหม่

---

## 6. Internal linking

Hub-and-spoke: `/` → type pages → use-case → blog → กลับไป type pages

- หน้าแรกลิงก์ไปทุก type page (เป็น hub)
- ทุก type page ลิงก์กลับหน้าแรก + ไป use-case ที่เกี่ยวข้อง 2–3 หน้า
- blog ทุกบทความลิงก์ไป type page ที่แก้ปัญหานั้นได้จริง
- ห้ามลิงก์แบบ "อ่านเพิ่มเติม" ลอย ๆ — anchor text ต้องเป็น keyword ของหน้าปลายทาง

---

## 7. Blog — 6 บทความแรก

เขียนตาม cluster "Problem" เพราะสร้าง trust และดึง backlink ได้ดีที่สุด

1. ทำไม QR Code ถึงหมดอายุ และวิธีเช็คว่าของคุณจะหมดหรือไม่
2. QR Code สแกนไม่ติด — 7 สาเหตุที่เจอบ่อยและวิธีแก้
3. พิมพ์ QR Code ยังไงไม่ให้เบลอ (ขนาดขั้นต่ำตามระยะสแกน)
4. Static vs Dynamic QR ต่างกันยังไง แบบไหนเหมาะกับร้านคุณ
5. ทำ QR พร้อมเพย์เองยังไงให้ถูกต้อง และข้อผิดพลาดที่ทำให้เงินเข้าผิดบัญชี
6. QR Code เมนูอาหาร — ตั้งแต่ออกแบบจนถึงติดหน้าร้าน

> เจ้าของโปรเจกต์เขียนเนื้อหาเอง — agent ทำได้แค่ outline
> บทความ AI ยาว ๆ ในตลาดที่แข่ง SEO ดุแบบนี้เป็นภาระ ไม่ใช่สินทรัพย์

---

## 8. Checklist หลัง deploy หน้าใหม่

- [ ] submit sitemap ใน Google Search Console
- [ ] ขอ index หน้าใหม่ด้วย URL Inspection
- [ ] validate JSON-LD ด้วย Rich Results Test
- [ ] เช็ค canonical ไม่ชี้ผิดหน้า
- [ ] เช็ค CWV ใน PageSpeed Insights (field data ใช้เวลา 28 วันจึงจะขึ้น)
- [ ] ตั้ง GA4 หรือ Vercel Analytics ให้เก็บ event `qr_created` และ `qr_downloaded`
