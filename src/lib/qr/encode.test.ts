import { describe, expect, it } from "vitest";
import { encodeQr, QrEncodeError, QUIET_ZONE_MODULES } from "./encode";
import { snapSizeToModules, svgToDataUri } from "./render-png";
import { dataModulesPath, renderSvg } from "./render-svg";
import { DEFAULT_QR_STYLE, type QrStyle } from "./style";

describe("encodeQr", () => {
  it("คืน matrix สี่เหลี่ยมจัตุรัสที่รวม quiet zone แล้ว", () => {
    const matrix = encodeQr("https://example.com", "M");

    expect(matrix.data).toHaveLength(matrix.size);
    for (const row of matrix.data) {
      expect(row).toHaveLength(matrix.size);
    }

    // version 1 = 21 module + quiet zone สองด้าน
    expect(matrix.size).toBeGreaterThanOrEqual(21 + QUIET_ZONE_MODULES * 2);
  });

  it("มุมทั้งสี่ของ quiet zone ต้องว่างเสมอ", () => {
    const matrix = encodeQr("test", "M");
    const last = matrix.size - 1;

    expect(matrix.data[0]?.[0]).toBe(false);
    expect(matrix.data[0]?.[last]).toBe(false);
    expect(matrix.data[last]?.[0]).toBe(false);
    expect(matrix.data[last]?.[last]).toBe(false);
  });

  it("margin ที่มากขึ้นทำให้ matrix ใหญ่ขึ้นตามจำนวนที่เพิ่ม", () => {
    const base = encodeQr("test", "M", 4);
    const wide = encodeQr("test", "M", 8);
    expect(wide.size).toBe(base.size + 8);
  });

  it("ไม่ยอมให้ margin ต่ำกว่าขั้นต่ำตามสเปก", () => {
    expect(encodeQr("test", "M", 0).size).toBe(encodeQr("test", "M", 4).size);
  });

  it("error correction สูงขึ้นทำให้ QR ใหญ่ขึ้นหรือเท่าเดิม", () => {
    const payload = "https://example.com/menu/summer-2026";
    expect(encodeQr(payload, "H").size).toBeGreaterThanOrEqual(
      encodeQr(payload, "L").size,
    );
  });

  it("รองรับข้อความภาษาไทยและ emoji", () => {
    expect(() => encodeQr("สแกนเพื่อชำระเงิน 🇹🇭", "M")).not.toThrow();
  });

  it("โยน QrEncodeError เมื่อ payload ว่าง", () => {
    expect(() => encodeQr("", "M")).toThrow(QrEncodeError);
  });

  it("โยน QrEncodeError เมื่อข้อมูลยาวเกินความจุของ QR", () => {
    expect(() => encodeQr("ก".repeat(10_000), "H")).toThrow(QrEncodeError);
  });
});

describe("renderSvg", () => {
  it("สร้าง SVG ที่มี viewBox ตรงกับขนาด matrix", () => {
    const matrix = encodeQr("https://example.com", "M");
    const svg = renderSvg(matrix, { size: 512 });

    expect(svg).toContain(`viewBox="0 0 ${matrix.size} ${matrix.size}"`);
    expect(svg).toContain('width="512" height="512"');
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("ใช้สีดำ/ขาวล้วนเป็นค่าเริ่มต้น", () => {
    const svg = renderSvg(encodeQr("test", "M"));
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('fill="#ffffff"');
  });

  it("รวม module ที่ติดกันในแนวนอนเมื่อจุดเป็นสี่เหลี่ยม", () => {
    const matrix = {
      size: 4,
      version: 1,
      data: [
        [true, true, true, false],
        [false, true, false, false],
        [false, false, false, false],
        [true, false, false, true],
      ],
    };

    // margin 4 กับ matrix ขนาด 4 แปลว่าไม่มี module ไหนอยู่ในกรอบตามุม
    const path = dataModulesPath(matrix, "square", []);
    expect(path).toBe("M0 0h3v1h-3zM1 1h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1z");
  });

  it("แต่ละรูปทรงจุดสร้าง path ที่ต่างกันจริง", () => {
    const matrix = encodeQr("https://example.com", "M");
    const paths = (["square", "rounded", "dot"] as const).map((shape) =>
      renderSvg(matrix, { style: { ...DEFAULT_QR_STYLE, dotShape: shape } }),
    );
    expect(new Set(paths).size).toBe(3);
  });

  it("ใส่ gradient defs เฉพาะเมื่อเลือกไล่เฉดสี", () => {
    const matrix = encodeQr("test", "M");
    expect(renderSvg(matrix)).not.toContain("<defs>");

    const gradient: QrStyle = {
      ...DEFAULT_QR_STYLE,
      gradientDirection: "diagonal",
      inkSecondary: "#123456",
    };
    const svg = renderSvg(matrix, { style: gradient });
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain('stop-color="#123456"');
    expect(svg).toContain("url(#qr-gradient)");
  });

  it("รองรับ radial gradient", () => {
    const svg = renderSvg(encodeQr("test", "M"), {
      style: { ...DEFAULT_QR_STYLE, gradientDirection: "radial" },
    });
    expect(svg).toContain("<radialGradient");
  });
});

describe("render-png helpers", () => {
  it("ปัดขนาดภาพให้หารด้วยจำนวน module ลงตัว", () => {
    // 29 module ใน 512px → 17px ต่อ module → 493px
    expect(snapSizeToModules(29, 512)).toBe(493);
    expect(snapSizeToModules(29, 512) % 29).toBe(0);
  });

  it("ไม่คืนขนาด 0 แม้ภาพเป้าหมายจะเล็กกว่า matrix", () => {
    expect(snapSizeToModules(100, 50)).toBe(100);
  });

  it("แปลง SVG เป็น data URI ที่ใช้เป็น src ได้", () => {
    const uri = svgToDataUri("<svg><rect/></svg>");
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(uri.split(",")[1] ?? "")).toBe(
      "<svg><rect/></svg>",
    );
  });
});
