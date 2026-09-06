import { describe, expect, it } from "vitest";
import {
  CTA_MAX_LENGTH,
  CTA_PRESETS,
  DEFAULT_FRAME,
  FRAME_KINDS,
  fitCtaText,
  frameLayout,
  type MeasureText,
  type QrFrame,
} from "./frame";

/** จำลองการวัดข้อความแบบง่าย: กว้าง = จำนวนอักขระ × ขนาดฟอนต์ × 0.6 */
const measure: MeasureText = (text, size) => text.length * size * 0.6;

function frame(overrides: Partial<QrFrame> = {}): QrFrame {
  return { ...DEFAULT_FRAME, kind: "bar", ...overrides };
}

describe("frameLayout", () => {
  it("ไม่มีกรอบ = ขนาดเท่า matrix เป๊ะ ไม่มีอะไรงอกออกมา", () => {
    const layout = frameLayout(33, frame({ kind: "none" }));
    expect(layout).toEqual({
      width: 33,
      height: 33,
      qrX: 0,
      qrY: 0,
      band: null,
      radius: 0,
    });
  });

  it("ข้อความว่างถือว่าไม่มีกรอบ แม้จะเลือกแบบมีแถบไว้", () => {
    expect(frameLayout(33, frame({ text: "   " })).band).toBeNull();
  });

  it("แบบแถบล่าง กว้างเท่าเดิม สูงขึ้นเฉพาะส่วนแถบ", () => {
    const layout = frameLayout(33, frame());
    expect(layout.width).toBe(33);
    expect(layout.height).toBeGreaterThan(33);
    expect(layout.qrX).toBe(0);
    expect(layout.qrY).toBe(0);
  });

  it("แถบอยู่ถัดจากขอบล่างของ matrix พอดี ไม่กิน quiet zone", () => {
    const layout = frameLayout(33, frame());
    expect(layout.band?.y).toBe(33);
    expect(layout.band?.x).toBe(0);
    expect(layout.band?.width).toBe(33);
  });

  it("แบบมีกรอบรอบ ดัน QR เข้ามาจากขอบทุกด้าน", () => {
    const layout = frameLayout(33, frame({ kind: "outline" }));
    expect(layout.qrX).toBeGreaterThan(0);
    expect(layout.qrY).toBeGreaterThan(0);
    expect(layout.width).toBe(33 + layout.qrX * 2);
    expect(layout.band?.x).toBe(layout.qrX);
  });

  it("QR เล็กมากก็ยังได้แถบที่สูงพอจะอ่านออก", () => {
    expect(frameLayout(21, frame()).band?.height).toBeGreaterThanOrEqual(5);
  });
});

describe("fitCtaText", () => {
  it("ข้อความสั้นอยู่บรรทัดเดียว", () => {
    const fitted = fitCtaText("สแกนดูเมนู", 600, 100, measure);
    expect(fitted.lines).toEqual(["สแกนดูเมนู"]);
  });

  it("ย่อฟอนต์ลงเมื่อข้อความยาวขึ้น แทนที่จะล้นกล่อง", () => {
    const short = fitCtaText("สแกน", 400, 100, measure);
    const long = fitCtaText("สแกนเพื่อชำระเงินที่นี่", 400, 100, measure);
    expect(long.fontSizePx).toBeLessThan(short.fontSizePx);
  });

  it("ตัดเป็นสองบรรทัดที่ช่องว่างเมื่อย่อแล้วยังไม่พอ", () => {
    const fitted = fitCtaText(
      "สแกนเพื่อชำระเงิน ผ่านพร้อมเพย์ทุกธนาคาร",
      300,
      60,
      measure,
    );
    expect(fitted.lines).toHaveLength(2);
    expect(fitted.lines.join(" ")).toBe("สแกนเพื่อชำระเงิน ผ่านพร้อมเพย์ทุกธนาคาร");
  });

  it("ไม่ตัดกลางคำไทยเมื่อไม่มีช่องว่าง — ย่อฟอนต์แทน", () => {
    const noSpace = "สแกนเพื่อชำระเงินผ่านพร้อมเพย์ทุกธนาคารได้เลย";
    const fitted = fitCtaText(noSpace, 200, 60, measure);
    expect(fitted.lines).toEqual([noSpace]);
  });

  it("แบ่งสองบรรทัดที่ช่องว่างใกล้กลางที่สุด ให้สองบรรทัดยาวใกล้เคียงกัน", () => {
    const fitted = fitCtaText(
      "ก ขขขขขขขขขขขข คคคคคคคคคคคค ง",
      100,
      40,
      measure,
    );
    const [first, second] = fitted.lines;
    expect(fitted.lines).toHaveLength(2);
    expect(Math.abs((first?.length ?? 0) - (second?.length ?? 0))).toBeLessThan(
      6,
    );
  });

  it("ข้อความว่างไม่คืนบรรทัดอะไรเลย", () => {
    expect(fitCtaText("   ", 400, 100, measure).lines).toEqual([]);
  });

  it("ข้อความยาวสุดที่ยอมให้กรอกยังจัดลงกล่องได้ ไม่พัง", () => {
    const longest = "ก".repeat(CTA_MAX_LENGTH);
    const fitted = fitCtaText(longest, 400, 100, measure);
    expect(fitted.fontSizePx).toBeGreaterThan(0);
    expect(fitted.lines).toHaveLength(1);
  });
});

describe("ข้อความสำเร็จรูป", () => {
  it("ทุกอันสั้นกว่าเพดานที่ช่องกรอกอนุญาต", () => {
    for (const preset of CTA_PRESETS) {
      expect(preset.length).toBeLessThanOrEqual(CTA_MAX_LENGTH);
    }
  });

  it("ไม่ซ้ำกัน", () => {
    expect(new Set(CTA_PRESETS).size).toBe(CTA_PRESETS.length);
  });

  it("ค่าเริ่มต้นคือไม่มีกรอบ เพื่อไม่ยัดเยียดให้คนที่ไม่ต้องการ", () => {
    expect(DEFAULT_FRAME.kind).toBe("none");
    expect(FRAME_KINDS[0]).toBe("none");
  });
});
