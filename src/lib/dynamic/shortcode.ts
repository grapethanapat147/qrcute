/**
 * shortcode ของ dynamic QR
 *
 * ⚠️ รูปแบบนี้ถูกพิมพ์ลงป้ายจริงแล้วเปลี่ยนไม่ได้อีก — ดู docs/decisions/0005-shortcode-format.md
 * ห้ามแก้ความยาวหรือชุดอักขระโดยไม่อ่าน ADR นั้นก่อน
 */

/**
 * 31 อักขระ ตัด 0 o 1 l i ออกเพราะคนพิมพ์ตามจากป้ายแล้วสับสน
 * ไม่มีตัวพิมพ์ใหญ่ เพราะบนป้ายพิมพ์เล็กอ่านง่ายกว่าและลดโอกาสพิมพ์ผิด
 */
export const SHORTCODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const SHORTCODE_LENGTH = 7;

const SHORTCODE_PATTERN = new RegExp(
  `^[${SHORTCODE_ALPHABET}]{${SHORTCODE_LENGTH}}$`,
);

/**
 * ค่ามากที่สุดที่หารด้วยขนาดชุดอักขระลงตัว
 *
 * 1 byte มี 256 ค่า แต่ 256 หารด้วย 31 ไม่ลงตัว ถ้าใช้ byte % 31 ตรง ๆ
 * อักขระต้น ๆ ของชุดจะออกบ่อยกว่าตัวอื่น ซึ่งลดพื้นที่การเดาลงจริง
 * จึงทิ้ง byte ที่เกิน 248 แล้วสุ่มใหม่ (rejection sampling)
 */
const UNBIASED_LIMIT =
  Math.floor(256 / SHORTCODE_ALPHABET.length) * SHORTCODE_ALPHABET.length;

/** แหล่งสุ่ม — แยกออกมาเพื่อให้ทดสอบพฤติกรรมการทิ้งค่าที่ทำให้เอนเอียงได้ */
export type RandomBytes = (length: number) => Uint8Array;

const cryptoRandomBytes: RandomBytes = (length) =>
  crypto.getRandomValues(new Uint8Array(length));

/**
 * สุ่ม shortcode ใหม่
 *
 * ใช้ CSPRNG เสมอ ห้ามใช้ Math.random และห้าม derive จาก id หรือเวลา
 * เพราะทั้งสองอย่างทำให้ไล่เดา shortcode ของลูกค้ารายอื่นได้
 */
export function generateShortcode(
  randomBytes: RandomBytes = cryptoRandomBytes,
): string {
  let code = "";

  while (code.length < SHORTCODE_LENGTH) {
    // ขอเผื่อไว้ เพราะบาง byte จะถูกทิ้ง
    const needed = SHORTCODE_LENGTH - code.length;
    const bytes = randomBytes(needed * 2);

    for (const byte of bytes) {
      if (code.length >= SHORTCODE_LENGTH) break;
      if (byte >= UNBIASED_LIMIT) continue;
      code += SHORTCODE_ALPHABET[byte % SHORTCODE_ALPHABET.length];
    }
  }

  return code;
}

export function isValidShortcode(code: string): boolean {
  return SHORTCODE_PATTERN.test(code);
}

/**
 * จำนวนค่าที่เป็นไปได้ทั้งหมด — ใช้ในเอกสารและใน test ที่ยืนยันขนาดพื้นที่การเดา
 */
export const SHORTCODE_KEYSPACE = SHORTCODE_ALPHABET.length ** SHORTCODE_LENGTH;

/**
 * สร้าง URL เต็มของ dynamic QR
 *
 * ความยาว URL กำหนดความถี่ของจุดใน QR โดยตรง — โดเมนยิ่งสั้นยิ่งพิมพ์เล็กได้
 * (ดูตารางเปรียบเทียบใน ADR 0005)
 */
export function shortcodeUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/r/${code}`;
}
