import { PLAN_QUOTAS } from "@/lib/billing/entitlements";
import { formatSatang, PRICES } from "@/lib/billing/plans";
import { REFUND_WINDOW_DAYS } from "@/lib/legal/refund";

/**
 * หน้าเปรียบเทียบ /vs/[competitor]
 *
 * ⚠️ กฎเหล็ก: ทุกข้อของคู่แข่งต้องมาจากหน้าทางการของเขาเอง และบันทึก URL กับวันที่ตรวจไว้
 * ข้อไหนหน้าเขาไม่ได้บอก ให้เขียนว่า "หน้าราคาไม่ได้ระบุ" ห้ามเติมจากรีวิวหรือความจำ
 * หน้าแบบนี้พูดถึงบริษัทอื่นตรง ๆ ถ้าผิดแม้ข้อเดียว เสียความน่าเชื่อถือทั้งเว็บ
 * และอาจถูกกล่าวหาว่าให้ข้อมูลเท็จเกี่ยวกับคู่แข่ง
 *
 * ราคาคู่แข่งแสดงเป็นสกุลเงินที่เขาประกาศ ไม่แปลงเป็นบาท เพราะอัตราแลกเปลี่ยนเปลี่ยนทุกวัน
 */

export type ComparisonRow = { label: string; us: string; them: string };

export type Comparison = {
  slug: string;
  name: string;
  sourceUrl: string;
  /** วันที่เปิดหน้าทางการของเขาตรวจล่าสุด — ต้องตรวจใหม่ก่อนแก้ข้อมูลทุกครั้ง */
  checkedAt: string;
  title: string;
  metaDescription: string;
  lede: string;
  rows: ComparisonRow[];
  /** เมื่อไรควรเลือกเขาแทนเรา — เขียนตรง ๆ ความยุติธรรมคือเหตุผลที่คนเชื่อหน้านี้ */
  chooseThem: string[];
  chooseUs: string[];
};

const PRO_MONTHLY = formatSatang(PRICES.pro_monthly.amountSatang);
const PRO_LIFETIME = formatSatang(PRICES.pro_lifetime.amountSatang);

/** แถวฝั่งเราที่ใช้ซ้ำทุกหน้า — ดึงจากค่าในระบบ ไม่พิมพ์ซ้ำ */
const OUR = {
  static: "ไม่จำกัด ไม่ต้องสมัคร ไม่มีวันหมดอายุ",
  freeDynamic: `${PLAN_QUOTAS.free.dynamic_qr} รายการ ไม่จำกัดจำนวนสแกน`,
  paidEntry: `${PRO_MONTHLY}/เดือน (${PLAN_QUOTAS.pro.dynamic_qr} รายการ)`,
  lifetime: `มี — ${PRO_LIFETIME} จ่ายครั้งเดียว`,
  promptpay: "มี ตามมาตรฐาน EMVCo ทดสอบกับแอปธนาคารไทยแล้ว",
  thai: "ภาษาไทยทั้งเว็บ",
  lapse: "ทำงานต่อ 30 วัน จากนั้นคนสแกนเห็นหน้าคั่นที่ยังกดไปปลายทางได้ หยุดจริงหลัง 120 วัน",
  refund: `คืนเงินเต็มจำนวนภายใน ${REFUND_WINDOW_DAYS} วัน`,
};

export const COMPARISONS: Comparison[] = [
  {
    slug: "qr-tiger",
    name: "QR TIGER",
    sourceUrl: "https://qrcode-tiger.com/payment",
    checkedAt: "2026-11-06",
    title: "QR Cute vs QR TIGER — เทียบราคาและเงื่อนไขสำหรับร้านค้าไทย",
    metaDescription:
      "เทียบ QR Cute กับ QR TIGER ทั้งราคา โควตา QR แบบแก้ปลายทางได้ พร้อมเพย์ และสิ่งที่เกิดขึ้นเมื่อหยุดจ่าย ข้อมูลจากหน้าราคาทางการ",
    lede: "QR TIGER เป็นเครื่องมือระดับโลกที่ฟีเจอร์ครบ ส่วนเราทำมาเพื่อร้านค้าไทยโดยเฉพาะ หน้านี้เทียบให้เห็นว่าต่างกันตรงไหน",
    rows: [
      { label: "QR แบบฝังข้อมูลตรง", us: OUR.static, them: "ไม่จำกัดในแพ็กเกจฟรี" },
      {
        label: "QR แก้ปลายทางได้ในแพ็กเกจฟรี",
        us: OUR.freeDynamic,
        them: "3 รายการ จำกัด 500 สแกนต่อรายการ มีป๊อปอัปโลโก้ QR TIGER",
      },
      {
        label: "แพ็กเกจจ่ายเงินเริ่มต้น",
        us: OUR.paidEntry,
        them: "US$7/เดือน (12 รายการ)",
      },
      { label: "แบบจ่ายครั้งเดียว", us: OUR.lifetime, them: "หน้าราคาไม่ได้ระบุ" },
      { label: "QR พร้อมเพย์", us: OUR.promptpay, them: "หน้าราคาไม่ได้ระบุ" },
      { label: "ภาษา", us: OUR.thai, them: "มีหน้าบทความภาษาไทย" },
      {
        label: "ถ้าหยุดจ่าย QR แบบแก้ได้จะเป็นยังไง",
        us: OUR.lapse,
        them: "หน้าราคาไม่ได้ระบุ",
      },
      { label: "การคืนเงิน", us: OUR.refund, them: "หน้าราคาไม่ได้ระบุ" },
    ],
    chooseThem: [
      "ต้องการ QR แบบแก้ปลายทางได้หลายร้อยรายการ — แพ็กเกจของเขาไปได้ถึง 600 รายการ",
      "ต้องการฟีเจอร์ที่เรายังไม่มี เช่น API หรือโดเมนของตัวเอง",
      "ทีมใช้ภาษาอังกฤษและจ่ายเป็นดอลลาร์อยู่แล้ว",
    ],
    chooseUs: [
      "ต้องการ QR รับเงินพร้อมเพย์ที่ทดสอบกับแอปธนาคารไทยแล้ว",
      "อยากจ่ายเป็นบาท หรือจ่ายครั้งเดียวจบไม่ต้องผูกรายเดือน",
      "อยากรู้ล่วงหน้าแน่ชัดว่าถ้าหยุดจ่าย ป้ายที่พิมพ์ไปแล้วจะเป็นยังไง",
    ],
  },
  {
    slug: "qr-code-generator",
    name: "QR Code Generator Pro",
    sourceUrl: "https://www.qr-code-generator.com/pricing/",
    checkedAt: "2026-11-06",
    title: "QR Cute vs QR Code Generator Pro — เทียบเงื่อนไขก่อนพิมพ์ป้าย",
    metaDescription:
      "เทียบ QR Cute กับ QR Code Generator Pro (qr-code-generator.com) ทั้งช่วงทดลองใช้ โควตา การต่ออายุ และสิ่งที่เกิดขึ้นเมื่อหยุดจ่าย ข้อมูลจากหน้าราคาทางการ",
    lede: "QR Code Generator Pro เริ่มต้นด้วยการทดลองใช้ 14 วัน ส่วนเราให้สร้าง QR ได้ฟรีโดยไม่ต้องสมัคร หน้านี้เทียบเงื่อนไขที่ควรรู้ก่อนเอา QR ไปพิมพ์",
    rows: [
      {
        label: "เริ่มใช้งาน",
        us: "สร้างได้ทันที ไม่ต้องสมัคร",
        them: "ทดลองใช้ฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต",
      },
      {
        label: "QR แก้ปลายทางได้ในแพ็กเกจเริ่มต้น",
        us: OUR.freeDynamic,
        them: "Starter 2 รายการ จำกัด 10,000 สแกน",
      },
      { label: "แบบจ่ายครั้งเดียว", us: OUR.lifetime, them: "หน้าราคาไม่ได้ระบุ" },
      {
        label: "การต่ออายุ",
        us: "ยังไม่มีการต่ออายุอัตโนมัติ",
        them: "ต่ออายุอัตโนมัติจนกว่าจะยกเลิก ต้องแจ้งล่วงหน้า 30 วันก่อนจบรอบบิล",
      },
      {
        label: "การลดแพ็กเกจ",
        us: "ยกเลิกได้ทุกเมื่อ ใช้ได้จนจบรอบที่จ่าย",
        them: "ลดแพ็กเกจได้หลังจบสัญญารอบแรกเท่านั้น",
      },
      { label: "QR พร้อมเพย์", us: OUR.promptpay, them: "หน้าราคาไม่ได้ระบุ" },
      {
        label: "ถ้าหยุดจ่าย QR แบบแก้ได้จะเป็นยังไง",
        us: OUR.lapse,
        them: "หน้าราคาไม่ได้ระบุ",
      },
      { label: "ภาษีมูลค่าเพิ่ม", us: "ราคารวมภาษีแล้ว", them: "ราคายังไม่รวม VAT" },
    ],
    chooseThem: [
      "ต้องการทำงานเป็นทีมหลายคนในบัญชีเดียว — แพ็กเกจของเขารองรับ 2–5 คน",
      "ต้องการ API หรือสร้าง QR จาก CSV จำนวนมาก ซึ่งเรายังไม่มี",
    ],
    chooseUs: [
      "อยากสร้าง QR ที่ใช้ได้ตลอดไปโดยไม่ต้องเริ่มช่วงทดลองใช้",
      "ไม่อยากผูกสัญญาที่ต้องแจ้งยกเลิกล่วงหน้า 30 วัน",
      "ต้องการ QR รับเงินพร้อมเพย์สำหรับหน้าร้าน",
    ],
  },
];

export function findComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((item) => item.slug === slug);
}
