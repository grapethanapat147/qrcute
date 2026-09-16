/**
 * หน้าคั่นสำหรับ QR ที่เจ้าของหยุดจ่าย (docs/decisions/0008-downgrade-behaviour.md)
 *
 * คนที่เห็นหน้านี้คือ **ลูกค้าของลูกค้าเรา** ที่ยืนสแกนป้ายอยู่หน้าร้าน
 * เขาไม่เคยตกลงอะไรกับเรา ไม่รู้ว่าเรามีตัวตน และไม่ควรต้องมารับผลของเรื่องเงิน
 * ระหว่างเรากับเจ้าของร้าน หน้านี้จึงมีกฎสามข้อ:
 *
 * 1. **ต้องกดไปปลายทางเดิมได้** — เจ้าของร้านที่ลืมจ่ายไม่ควรเสียลูกค้าเพราะเรา
 * 2. **ห้ามโทษเจ้าของร้านต่อหน้าลูกค้าเขา**
 * 3. **ต้องบอกว่ากำลังจะไปที่ไหน** — หน้าคั่นที่ซ่อนปลายทางคือรูปแบบเดียวกับ
 *    หน้า phishing ถ้าไม่บอก เราก็ฝึกให้คนไทยกดลิงก์มั่ว ๆ
 *
 * เขียนเป็น HTML ก้อนเดียวจบ ไม่มี CSS/JS ภายนอก เพราะเส้นทางนี้อยู่บน edge
 * และคนสแกนมักอยู่บน 4G หน้าร้าน — ทุก request เพิ่มคือเวลาที่เขายืนรอ
 */

export type InterstitialKind = "suspended" | "disabled";

/**
 * ยอมให้ลิงก์เฉพาะ http/https
 *
 * ปลายทางถูกกรองตอนบันทึกอยู่แล้ว แต่ค่านี้จะถูกเอาไปใส่ href ที่ผู้ใช้กดจริง
 * ถ้าวันหนึ่งการกรองตอนบันทึกพลาด `javascript:` จะกลายเป็น XSS ทันที
 * กันซ้ำอีกชั้นตรงจุดที่มันถูกใช้งาน ราคาถูกกว่าการมานั่งเสียใจ
 */
export function safeHttpUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  return url.protocol === "http:" || url.protocol === "https:"
    ? url.toString()
    : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ชื่อโฮสต์ล้วน ๆ ให้คนอ่านออกว่ากำลังจะไปไหน */
export function destinationLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

const STYLES = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100dvh;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  background: #fafaf9; color: #1c1917;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.7;
  word-break: break-word;
}
main { width: 100%; max-width: 26rem; text-align: center; }
h1 { font-size: 1.375rem; line-height: 1.5; margin: 0 0 12px; }
p { margin: 0 0 24px; color: #57534e; }
a.go {
  display: block; padding: 16px 20px; border-radius: 12px;
  background: #1c1917; color: #fafaf9;
  font-size: 1.0625rem; font-weight: 600; text-decoration: none;
}
.dest { margin: 16px 0 0; font-size: 0.875rem; color: #78716c; }
footer { margin-top: 40px; font-size: 0.8125rem; }
footer a { color: #78716c; }
@media (prefers-color-scheme: dark) {
  body { background: #1c1917; color: #fafaf9; }
  p { color: #a8a29e; }
  a.go { background: #fafaf9; color: #1c1917; }
  .dest, footer a { color: #a8a29e; }
}
`.trim();

export type InterstitialInput = {
  kind: InterstitialKind;
  /** ปลายทางเดิม — ถ้าไม่ปลอดภัยหรือไม่มี ปุ่มจะไม่ถูกแสดง */
  target: string | null;
  siteName: string;
  siteUrl: string;
};

export function renderInterstitial(input: InterstitialInput): string {
  const safeTarget =
    input.kind === "suspended" && input.target !== null
      ? safeHttpUrl(input.target)
      : null;

  // ถ้อยคำต้องเป็นกลาง ห้ามพูดถึงเรื่องเงินหรือความผิดของใคร (กฎข้อ 2)
  const heading =
    safeTarget === null ? "QR นี้ไม่ได้ใช้งานแล้ว" : "อีกขั้นตอนเดียวก็ถึงปลายทาง";

  const detail =
    safeTarget === null
      ? "ลองสอบถามจากร้านหรือคนที่ให้ QR นี้กับคุณได้เลย"
      : "กดปุ่มด้านล่างเพื่อไปยังปลายทางของ QR นี้";

  const action =
    safeTarget === null
      ? ""
      : `<a class="go" href="${escapeHtml(safeTarget)}" rel="noopener nofollow">ไปยังปลายทาง</a>
      <p class="dest">คุณกำลังจะไปที่ ${escapeHtml(destinationLabel(safeTarget))}</p>`;

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(heading)}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(detail)}</p>
  ${action}
  <footer><a href="${escapeHtml(input.siteUrl)}" rel="noopener">${escapeHtml(input.siteName)}</a></footer>
</main>
</body>
</html>`;
}
