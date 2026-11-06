/**
 * ป้ายรับเงินพร้อมเพย์ — ชื่อร้านด้านบน QR และชื่อบัญชีด้านล่าง
 *
 * ชื่อบัญชีมีไว้ให้ลูกค้าเทียบกับชื่อผู้รับที่แอปธนาคารแสดงก่อนกดโอน
 * ซึ่งเป็นวิธีที่ลูกค้าจับได้ถ้ามีคนเอา QR อื่นมาแปะทับป้ายของร้าน
 *
 * ทุกฟังก์ชันในไฟล์นี้ไม่สนหน่วย — ส่งมิลลิเมตร (PDF) หรือพิกเซล (PNG) ก็ได้
 */

export const SIGN_SHOP_NAME_MAX = 40;
export const SIGN_ACCOUNT_NAME_MAX = 60;

export type PaymentSign = {
  shopName: string;
  accountName: string;
};

export const EMPTY_SIGN: PaymentSign = { shopName: "", accountName: "" };

export type SignLine = { text: string; weight: 400 | 700; color: string };

export function isSignEmpty(sign: PaymentSign): boolean {
  return sign.shopName.trim() === "" && sign.accountName.trim() === "";
}

export function signHeaderLines(sign: PaymentSign): SignLine[] {
  const name = sign.shopName.trim();
  return name === "" ? [] : [{ text: name, weight: 700, color: "#111111" }];
}

export function signFooterLines(sign: PaymentSign): SignLine[] {
  const name = sign.accountName.trim();
  if (name === "") return [];
  return [
    { text: `ชื่อบัญชี ${name}`, weight: 700, color: "#111111" },
    {
      text: "ตรวจชื่อผู้รับในแอปให้ตรงก่อนกดโอน",
      weight: 400,
      color: "#444444",
    },
  ];
}

export type Box = { x: number; y: number; width: number; height: number };

export type SignLayout = {
  blockX: number;
  blockY: number;
  header: Box | null;
  footer: Box | null;
};

/** ขอบกระดาษและระยะห่างจาก QR เป็นสัดส่วนของความกว้างหน้า */
const MARGIN_RATIO = 0.06;
const GAP_RATIO = 0.03;
/** ช่องข้อความที่เตี้ยกว่านี้ตัวอักษรจะเล็กจนอ่านไม่ออก จึงไม่วาดเลย */
const MIN_BOX_RATIO = 0.08;

/**
 * วาง QR กลางหน้า (ตำแหน่งเดียวกับ PDF ที่ไม่มีป้าย) แล้วใช้ที่ว่างบน/ล่างเป็นช่องข้อความ
 * คืน null ในช่องที่ไม่มีที่พอ เช่น สติกเกอร์ที่ QR เต็มแผ่น
 */
export function signLayout(
  pageWidth: number,
  pageHeight: number,
  blockWidth: number,
  blockHeight: number,
): SignLayout {
  const margin = pageWidth * MARGIN_RATIO;
  const gap = pageWidth * GAP_RATIO;
  const blockX = (pageWidth - blockWidth) / 2;
  const blockY = (pageHeight - blockHeight) / 2;
  const boxHeight = blockY - margin - gap;
  const fits = boxHeight >= pageWidth * MIN_BOX_RATIO;

  return {
    blockX,
    blockY,
    header: fits
      ? {
          x: margin,
          y: margin,
          width: pageWidth - margin * 2,
          height: boxHeight,
        }
      : null,
    footer: fits
      ? {
          x: margin,
          y: blockY + blockHeight + gap,
          width: pageWidth - margin * 2,
          height: boxHeight,
        }
      : null,
  };
}
