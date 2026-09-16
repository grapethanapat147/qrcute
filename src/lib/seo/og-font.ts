/**
 * ดึงฟอนต์ไทยสำหรับ og:image
 *
 * `next/og` ไม่มีฟอนต์ไทยติดมาด้วย ถ้าเรนเดอร์ข้อความไทยโดยไม่ใส่ฟอนต์
 * จะได้กล่องสี่เหลี่ยมเรียงกันทั้งภาพ ซึ่งแย่กว่าไม่มี og:image เสียอีก
 *
 * ใช้วิธีขอ subset เฉพาะอักขระที่จะใช้จริงผ่านพารามิเตอร์ `text`
 * ไฟล์ที่ได้จึงเล็กมาก (ไม่กี่ KB) แทนที่จะโหลดฟอนต์ไทยทั้งชุด
 *
 * ⚠️ ฟังก์ชันนี้ต้องไม่โยน error เด็ดขาด เพราะมันถูกเรียกตอน build
 * ของหน้า SSG ทุกหน้า ถ้า network มีปัญหาแล้วโยน error ขึ้นไป
 * การ deploy ทั้งครั้งจะล้มเพราะเรื่องรูปภาพประกอบโซเชียล ซึ่งไม่คุ้มกันเลย
 * ล้มเหลวเมื่อไรคืน null แล้วให้ผู้เรียกตัดสินใจเองว่าจะเรนเดอร์ยังไงต่อ
 */

const FONT_CSS_ENDPOINT = "https://fonts.googleapis.com/css2";
const FETCH_TIMEOUT_MS = 4000;

/** User-Agent เก่าพอที่ Google จะตอบกลับมาเป็น ttf ไม่ใช่ woff2 ซึ่ง next/og อ่านไม่ได้ */
const TTF_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.20.25 (KHTML, like Gecko) Version/5.0.4 Safari/533.20.27";

export async function loadThaiFont(
  text: string,
  weight = 700,
): Promise<ArrayBuffer | null> {
  try {
    const url = new URL(FONT_CSS_ENDPOINT);
    url.searchParams.set("family", `Noto Sans Thai:wght@${weight}`);
    // ขอเฉพาะอักขระที่ใช้จริงในภาพนี้
    url.searchParams.set("text", text);

    const css = await fetch(url, {
      headers: { "User-Agent": TTF_USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }).then((response) => (response.ok ? response.text() : null));

    if (css === null) return null;

    const fontUrl = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (fontUrl === undefined) return null;

    const font = await fetch(fontUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return font.ok ? await font.arrayBuffer() : null;
  } catch {
    // ตั้งใจกลืน — ดูเหตุผลในคอมเมนต์หัวไฟล์
    return null;
  }
}
