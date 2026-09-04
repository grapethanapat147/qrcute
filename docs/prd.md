# PRD — Feature Spec

สถานะ: ร่างแรก · อัปเดตล่าสุด 22 ส.ค. 2026
เอกสารนี้ตอบว่า **ฟีเจอร์ไหนอยู่ tier ไหน และเสร็จแล้วหน้าตาเป็นยังไง**
เหตุผลเชิงธุรกิจอยู่ใน `docs/strategy.md` ลำดับเวลาอยู่ใน `docs/roadmap.md`

รูปแบบ: ทุกฟีเจอร์มี **AC (Acceptance Criteria)** ที่ตรวจได้จริง
AC ที่ขึ้นต้นด้วย 🧪 = ต้องมี automated test ครอบ

---

## 0. Non-functional requirements (ใช้กับทุกฟีเจอร์)

| ด้าน | เกณฑ์ |
| --- | --- |
| Core Web Vitals | LCP < 2.0s · INP < 200ms · CLS < 0.05 วัดจาก field data |
| Lighthouse | Performance ≥ 90 · Accessibility ≥ 95 · SEO = 100 บนหน้าหลัก |
| a11y | ใช้คีย์บอร์ดล้วนได้ครบทุก flow · contrast ≥ 4.5:1 · `aria-label` ภาษาไทย |
| Browser | Chrome/Safari/Edge 2 เวอร์ชันล่าสุด · Safari iOS 16+ · Chrome Android |
| ภาษา | UI ไทยทั้งหมด · ตัดบรรทัดไทยถูกต้อง ไม่มีสระลอย |
| ความเป็นส่วนตัว | ไม่เก็บเนื้อหา QR ของผู้ใช้ที่ไม่ได้ล็อกอินขึ้น server |

---

## 1. Static QR Generator (Free) — Phase 1

ฟีเจอร์แกนกลาง ทุกอย่างที่เหลือต่อยอดจากนี้

### 1.1 ประเภทที่รองรับ (ชุดแรก 8 ประเภท)

URL · ข้อความ · WiFi · vCard · โทร · SMS · Email · LINE

### 1.2 AC

- ผู้ใช้ที่ไม่ล็อกอินสร้าง QR และดาวน์โหลดได้ครบ โดยไม่มี modal ขวางทาง
- เปิดหน้าแรกแล้วสร้าง QR อันแรกได้ภายใน **5 วินาที** (พิมพ์ URL → เห็น preview)
- QR render **ฝั่ง client 100%** ไม่มี network request ไปสร้าง QR
- Preview อัปเดตขณะพิมพ์ โดย debounce ที่ไม่ทำให้รู้สึกกระตุก
- ดาวน์โหลด PNG ได้ 3 ขนาด (512 / 1024 / 2048 px) และ SVG
- เลือก error correction level L/M/Q/H ได้ พร้อมคำอธิบายภาษาไทยว่าเลือกอันไหนเมื่อไหร่
- state อยู่ใน URL (`/qr/wifi?ssid=...`) แชร์และบุ๊กมาร์กได้ และเป็นฐานของ programmatic SEO
- 🧪 encode ทุกประเภทแล้ว decode กลับต้องได้ payload เดิม (round-trip test)
- 🧪 อักขระไทย/emoji/สตริงยาวสุดที่ spec รองรับ ไม่ทำให้ encoder พัง

### 1.3 ไม่รวมใน Phase นี้

โลโก้ · สีกำหนดเอง · frame · PDF · บันทึกลงบัญชี

---

## 2. PromptPay QR (Free) — Phase 2

**ฟีเจอร์ที่สำคัญที่สุดของโปรเจกต์** ถ้าอันนี้ผิด positioning ทั้งหมดพัง

### 2.1 AC

- รองรับ payload: เบอร์โทร · เลขบัตรประชาชน · Tax ID · e-Wallet ID
- ระบุจำนวนเงินได้ หรือเว้นว่างให้ผู้จ่ายกรอกเอง
- คำนวณ **CRC16** และ validate payload ก่อนแสดงผลเสมอ — ถ้า validate ไม่ผ่าน ห้ามแสดง QR
- normalize input ให้ถูกต้อง (เบอร์ `0812345678` → รูปแบบตามสเปก) และแจ้งผู้ใช้ว่าถูกแปลงเป็นอะไร
- preview แสดงข้อมูลผู้รับและจำนวนเงินให้ผู้ใช้ตรวจก่อนดาวน์โหลด
- มี disclaimer ชัดเจนว่าให้ทดสอบสแกนด้วยแอปธนาคารก่อนนำไปใช้จริง
- 🧪 **golden test** เทียบกับ payload อ้างอิงที่รู้ผลลัพธ์แน่นอน
- 🧪 CRC16 ตรงกับค่าที่คำนวณด้วยวิธีอิสระ
- 🧪 input ผิดรูปแบบทุกแบบต้อง reject พร้อมข้อความไทยที่บอกวิธีแก้

### 2.2 ข้อห้าม

> **ห้ามเดาสเปก** ถ้าจุดไหนไม่แน่ใจให้เว้น `TODO` และระบุว่าต้องไปตรวจกับเอกสารอะไร
> อย่าเขียนโค้ดที่เดาแล้วดูเหมือนถูก — QR ที่ "เกือบถูก" อันตรายกว่า QR ที่สร้างไม่ได้

### 2.3 Definition of Done ของ Phase นี้

พิมพ์ QR พร้อมเพย์จากเว็บนี้ออกกระดาษ แล้วสแกนติดด้วยแอปธนาคารจริง **อย่างน้อย 3 แอป**
(ต้องมี checklist การทดสอบให้เจ้าของโปรเจกต์ไปทำเอง)

---

## 3. Customization + Print Export (Pro) — Phase 2

### 3.1 AC — Customization

- ใส่โลโก้ตรงกลางได้ โดยระบบ **จำกัดขนาดอัตโนมัติ** ไม่ให้เกินความสามารถของ error correction ที่เลือก
- เตือนผู้ใช้เมื่อการตั้งค่าปัจจุบันเสี่ยงสแกนไม่ติด
- เลือกสีจุด/พื้นหลังได้ แต่ระบบ **บล็อก** ถ้า contrast ต่ำกว่าเกณฑ์ พร้อมอธิบายเหตุผลเป็นภาษาไทย
- frame + CTA ภาษาไทย ("สแกนเพื่อชำระเงิน", "สแกนดูเมนู") ตัดคำถูก ไม่มีสระลอย
- 🧪 ข้อความ CTA สั้น/ยาว/ยาวมาก ไม่ทำให้ layout พัง
- 🧪 logo ที่ใหญ่เกินเกณฑ์ถูกย่อลงหรือถูก reject

### 3.2 AC — Export

- PDF ที่มี quiet zone ถูกต้อง (≥ 4 module) ขนาดจริงเป็นมิลลิเมตร CMYK-safe
- Preset: สติกเกอร์ 5×5 ซม. · ป้ายตั้งโต๊ะ A6 · ป้ายไวนิล 60×40 ซม.
- แสดงคำแนะนำขนาดขั้นต่ำตามระยะสแกนที่ผู้ใช้ระบุ
- 🧪 ขนาดจริงใน PDF ตรงกับที่เลือก (ตรวจจาก PDF metadata)

---

## 4. Auth + Dynamic QR (Pro) — Phase 3

### 4.1 Schema (ต้องอนุมัติ ER diagram ก่อนเขียนโค้ด)

`profiles` · `qr_codes` · `qr_versions` · `scans` · `subscriptions` · `entitlements`

### 4.2 AC

- **RLS ทุกตาราง** ไม่มีตารางไหนเปิดโล่ง
- 🧪 test ยืนยันว่า user A อ่าน/แก้ข้อมูลของ user B ไม่ได้
- `/r/[shortcode]` redirect ทำงานบน edge runtime **p95 < 100ms**
- บันทึก scan event แบบ async ไม่บล็อก redirect
- เก็บเฉพาะ timestamp · ประเทศ/จังหวัด · device type · referrer
  **ห้ามเก็บ IP ดิบ** ต้อง hash และมีข้อความ PDPA รองรับ
- Dashboard: list / แก้ปลายทาง / เปลี่ยนชื่อ / archive / ดูประวัติเวอร์ชัน
- ผู้ใช้ที่สร้าง static QR แบบไม่ล็อกอิน **claim เข้าบัญชีได้** (draft ใน localStorage → merge ตอนสมัคร)
- 🧪 แก้ปลายทางแล้ว shortcode เดิมยังใช้ได้ และเวอร์ชันเก่าถูกบันทึก

### 4.3 ข้อห้าม

> **static QR ต้องชี้ปลายทางตรงเสมอ** ห้ามแอบเปลี่ยนไปวิ่งผ่าน `/r/` ไม่ว่ากรณีใด
> 🧪 ต้องมี test ที่ fail ถ้ามีใครทำแบบนั้นในอนาคต

---

## 5. Billing + Entitlement — Phase 4

### 5.1 AC

- รองรับทั้ง subscription (รายเดือน/รายปี) และ **lifetime one-time**
- **Entitlement layer แยกจาก billing** — โค้ดที่เช็คสิทธิ์ต้องไม่รู้จัก gateway
  API: `hasFeature(user, 'dynamic_qr')` · `getQuota(user, 'dynamic_qr')`
- Webhook **idempotent** และ retry-safe มี log ตรวจย้อนหลังได้
- 🧪 ยิง webhook ซ้ำ 3 ครั้งด้วย payload เดิม → สิทธิ์ต้องไม่เปลี่ยนเกิน 1 ครั้ง
- 🧪 lifetime user ต้องไม่ถูก downgrade เมื่อ subscription webhook อื่นเข้ามา
- จ่ายเงินจริงได้ 1 รอบ end-to-end บน production

### 5.2 Downgrade behavior (ต้องเขียนเป็นสเปกให้ชัดก่อนเขียนโค้ด)

เลิกจ่ายแล้ว dynamic QR เกิดอะไรขึ้น — ต้องมี grace period + แจ้งเตือนล่วงหน้า + **ไม่ตายทันที**
เพราะ QR ที่พิมพ์ไปแล้วอยู่บนป้ายจริงในโลกจริง

### 5.3 Payment gateway

ยังไม่เลือก — ต้องเปรียบเทียบ (fee / รองรับ PromptPay / recurring / ความยาก integrate)
แล้วให้เจ้าของโปรเจกต์ตัดสินใจ **ก่อน** เขียนโค้ด และบันทึกเป็น ADR

---

## 6. SEO Engine — Phase 5

- Programmatic `/qr/[type]` และ `/use-case/[industry]`
- แต่ละหน้าต้องมี **เนื้อหาเฉพาะตัว**: intro · ขั้นตอน · ตัวอย่างจริง · FAQ 5 ข้อ · related links
- **ห้ามใช้ template ที่เปลี่ยนแค่คำเดียว** (เสี่ยงถูกมองเป็น doorway page)
- generator ของประเภทนั้นต้องอยู่บนหน้านั้นเลย ไม่ redirect ไปหน้าแรก
- รายละเอียดทั้งหมดอยู่ใน `docs/seo.md`

---

## 7. Hardening — Phase 6

- Safe Browsing check ตอนสร้างและตอน redirect
- Rate limit ต่อ IP และต่อ account
- Interstitial เตือนเมื่อปลายทางน่าสงสัย
- ระบบ report + admin blacklist
- PDPA: privacy policy · cookie consent · สิทธิ์ลบข้อมูล · data retention
  (ต้องระบุว่าจุดไหนควรให้ทนายตรวจ — เอกสารนี้ไม่ใช่คำแนะนำทางกฎหมาย)
- CSP header · audit RLS รอบสอง · input validation ทุก endpoint

---

## 8. สิ่งที่ **ไม่** อยู่ใน 9 สัปดาห์แรก

Business tier · REST API · white-label · custom domain · team seats ·
bulk CSV · QR menu builder · i18n ภาษาอังกฤษ · mobile app

เก็บไว้ใน `docs/strategy.md` §4 เป็นภาพปลายทาง แต่ห้ามหลุดเข้ามาใน sprint
