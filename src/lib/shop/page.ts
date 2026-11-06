import { safeHttpUrl } from "@/lib/dynamic/interstitial";

/**
 * ตรวจข้อมูลหน้าร้านก่อนบันทึก
 *
 * ⚠️ ลิงก์ที่ผู้ใช้ใส่จะไปแสดงบนโดเมนของเรา รับเฉพาะ http/https เท่านั้น
 * ไม่งั้น javascript: จะกลายเป็น XSS และหน้าร้านจะกลายเป็นเครื่องมือ phishing
 * ที่ดูน่าเชื่อถือเพราะอยู่บนโดเมนเรา ตอนแสดงผลก็ตรวจซ้ำอีกชั้น
 */

export const MAX_LINKS = 10;

export type ShopLink = { label: string; url: string };

export type ShopPageInput = {
  name: string;
  description: string;
  phone: string;
  hours: string;
  links: ShopLink[];
};

export type ShopValidation =
  | { ok: true; value: ShopPageInput }
  | { ok: false; message: string };

const LIMITS = { name: 80, description: 300, phone: 20, hours: 120, label: 40 };

export function validateShopPage(raw: ShopPageInput): ShopValidation {
  const name = raw.name.trim();
  if (name === "") return { ok: false, message: "ใส่ชื่อร้านก่อน" };
  if (name.length > LIMITS.name) {
    return { ok: false, message: `ชื่อร้านยาวได้ไม่เกิน ${LIMITS.name} ตัวอักษร` };
  }

  const description = raw.description.trim();
  if (description.length > LIMITS.description) {
    return {
      ok: false,
      message: `คำอธิบายยาวได้ไม่เกิน ${LIMITS.description} ตัวอักษร`,
    };
  }

  const phone = raw.phone.replace(/[^\d+]/g, "");
  if (phone.length > LIMITS.phone)
    return { ok: false, message: "เบอร์โทรไม่ถูกต้อง" };

  const hours = raw.hours.trim();
  if (hours.length > LIMITS.hours) {
    return { ok: false, message: `เวลาเปิดปิดยาวได้ไม่เกิน ${LIMITS.hours} ตัวอักษร` };
  }

  const links: ShopLink[] = [];
  for (const link of raw.links) {
    const label = link.label.trim();
    const rawUrl = link.url.trim();
    if (label === "" && rawUrl === "") continue;

    // เติม https:// ให้ถ้าผู้ใช้พิมพ์แค่ชื่อเว็บ เหมือนที่ generator ทำ
    const url = safeHttpUrl(
      /^[a-z]+:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`,
    );
    if (url === null || rawUrl === "") {
      return {
        ok: false,
        message: `ลิงก์ "${label || rawUrl}" ต้องเป็นลิงก์เว็บ เช่น https://…`,
      };
    }
    if (label === "") return { ok: false, message: `ใส่ชื่อปุ่มให้ลิงก์ ${url}` };
    if (label.length > LIMITS.label) {
      return { ok: false, message: `ชื่อปุ่มยาวได้ไม่เกิน ${LIMITS.label} ตัวอักษร` };
    }
    links.push({ label, url });
  }
  if (links.length > MAX_LINKS) {
    return { ok: false, message: `ใส่ลิงก์ได้ไม่เกิน ${MAX_LINKS} อัน` };
  }

  return { ok: true, value: { name, description, phone, hours, links } };
}

/** อ่าน links จาก jsonb ที่มาจากฐานข้อมูล — ตรวจซ้ำตอนแสดงผล ไม่เชื่อข้อมูลเก่า */
export function readShopLinks(value: unknown): ShopLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const label = typeof item?.label === "string" ? item.label : "";
    const url = typeof item?.url === "string" ? safeHttpUrl(item.url) : null;
    return label !== "" && url !== null ? [{ label, url }] : [];
  });
}
