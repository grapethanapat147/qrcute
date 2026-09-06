import { describe, expect, it } from "vitest";
import {
  buildPromptPayPayload,
  crc16ccitt,
  formatPromptPayMobile,
  PromptPayError,
  type PromptPayInput,
  validatePromptPay,
  verifyPromptPayChecksum,
} from "./promptpay";

function input(overrides: Partial<PromptPayInput> = {}): PromptPayInput {
  return {
    targetType: "mobile",
    target: "0801234567",
    amount: "",
    ...overrides,
  };
}

describe("crc16ccitt", () => {
  it("ตรงกับค่าตรวจสอบมาตรฐานของ CRC-16/CCITT-FALSE", () => {
    // ค่านี้เป็น check value ที่ประกาศไว้ในสเปกของอัลกอริทึม
    // ถ้าข้อนี้ผ่าน แปลว่า CRC ของเราถูกต้องโดยไม่ต้องพึ่ง PromptPay
    expect(crc16ccitt("123456789")).toBe(0x29b1);
  });

  it("ให้ค่าต่างกันเมื่อข้อมูลต่างกันแม้เพียงหลักเดียว", () => {
    expect(crc16ccitt("0066801234567")).not.toBe(crc16ccitt("0066801234568"));
  });
});

/**
 * Golden vector จาก dtinth/promptpay-qr ซึ่งเป็น reference implementation
 * ที่ใช้งานจริงกับแอปธนาคารไทยมานาน — ถ้า test ชุดนี้แดง แปลว่าเราทำสเปกพัง
 */
describe("golden vectors", () => {
  const cases: Array<{
    name: string;
    input: PromptPayInput;
    expected: string;
  }> = [
    {
      name: "เบอร์โทรแบบไม่มีขีด",
      input: input({ target: "0801234567" }),
      expected:
        "00020101021129370016A000000677010111011300668012345675802TH530376463046197",
    },
    {
      name: "เบอร์โทรแบบมีขีด ต้องได้ผลเหมือนไม่มีขีด",
      input: input({ target: "080-123-4567" }),
      expected:
        "00020101021129370016A000000677010111011300668012345675802TH530376463046197",
    },
    {
      name: "เบอร์โทรรูปแบบสากล +66",
      input: input({ target: "+66-89-123-4567" }),
      expected:
        "00020101021129370016A000000677010111011300668912345675802TH5303764630429C1",
    },
    {
      name: "เลขบัตรประชาชน",
      input: input({ targetType: "nationalId", target: "1111111111111" }),
      expected:
        "00020101021129370016A000000677010111021311111111111115802TH530376463047B5A",
    },
    {
      name: "เลขบัตรประชาชนแบบมีขีด",
      input: input({ targetType: "nationalId", target: "1-1111-11111-11-1" }),
      expected:
        "00020101021129370016A000000677010111021311111111111115802TH530376463047B5A",
    },
    {
      name: "เลขประจำตัวผู้เสียภาษี",
      input: input({ targetType: "taxId", target: "0123456789012" }),
      expected:
        "00020101021129370016A000000677010111021301234567890125802TH530376463040CBD",
    },
    {
      name: "e-Wallet ID",
      input: input({ targetType: "ewallet", target: "012345678901234" }),
      expected:
        "00020101021129390016A00000067701011103150123456789012345802TH530376463049781",
    },
    {
      name: "ระบุจำนวนเงิน — point of initiation ต้องเปลี่ยนเป็น 12",
      input: input({ target: "000-000-0000", amount: "4.22" }),
      expected:
        "00020101021229370016A000000677010111011300660000000005802TH530376454044.226304E469",
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(buildPromptPayPayload(testCase.input)).toBe(testCase.expected);
    });
  }

  it("ทุก golden vector ต้องผ่านการตรวจ CRC ของเราเอง", () => {
    for (const testCase of cases) {
      expect(verifyPromptPayChecksum(testCase.expected)).toBe(true);
    }
  });
});

describe("formatPromptPayMobile", () => {
  it("แปลงเบอร์ในประเทศเป็นรูปแบบ 13 หลัก", () => {
    expect(formatPromptPayMobile("0801234567")).toBe("0066801234567");
    expect(formatPromptPayMobile("080-123-4567")).toBe("0066801234567");
  });

  it("รองรับเบอร์ที่มีรหัสประเทศมาแล้ว", () => {
    expect(formatPromptPayMobile("+66 89 123 4567")).toBe("0066891234567");
    expect(formatPromptPayMobile("66891234567")).toBe("0066891234567");
  });

  it("ผลลัพธ์ยาว 13 อักขระเสมอ", () => {
    expect(formatPromptPayMobile("0801234567")).toHaveLength(13);
    expect(formatPromptPayMobile("66891234567")).toHaveLength(13);
  });
});

describe("verifyPromptPayChecksum", () => {
  it("จับได้เมื่อมีตัวเลขในข้อมูลถูกแก้", () => {
    const valid = buildPromptPayPayload(input({ target: "0801234567" }));
    const tampered = valid.replace("0066801234567", "0066801234568");
    expect(verifyPromptPayChecksum(valid)).toBe(true);
    expect(verifyPromptPayChecksum(tampered)).toBe(false);
  });

  it("ปฏิเสธ payload ที่ไม่มี tag CRC", () => {
    expect(verifyPromptPayChecksum("0002010102111234")).toBe(false);
    expect(verifyPromptPayChecksum("")).toBe(false);
  });
});

describe("validatePromptPay", () => {
  it("ผ่านเมื่อข้อมูลถูกต้อง", () => {
    expect(validatePromptPay(input())).toBeNull();
    expect(validatePromptPay(input({ amount: "100" }))).toBeNull();
  });

  it("บล็อกเบอร์โทรที่หลักไม่ครบ", () => {
    expect(validatePromptPay(input({ target: "08123456" }))).toContain(
      "10 หลัก",
    );
  });

  it("บล็อกเลขบัตรประชาชนที่ไม่ใช่ 13 หลัก", () => {
    expect(
      validatePromptPay(input({ targetType: "nationalId", target: "123" })),
    ).toContain("13 หลัก");
  });

  it("บล็อก e-Wallet ID ที่ไม่ใช่ 15 หลัก", () => {
    expect(
      validatePromptPay(input({ targetType: "ewallet", target: "12345" })),
    ).toContain("15 หลัก");
  });

  it("บล็อกจำนวนเงินติดลบ ศูนย์ และที่ไม่ใช่ตัวเลข", () => {
    expect(validatePromptPay(input({ amount: "-5" }))).toContain("มากกว่า 0");
    expect(validatePromptPay(input({ amount: "0" }))).toContain("มากกว่า 0");
    expect(validatePromptPay(input({ amount: "abc" }))).toContain("ตัวเลข");
  });

  it("บล็อกจำนวนเงินที่เกินเพดานของมาตรฐาน", () => {
    expect(validatePromptPay(input({ amount: "10000000000" }))).toContain(
      "เกินกว่า",
    );
  });

  it("buildPromptPayPayload โยน error แทนการคืน payload ที่ผิด", () => {
    expect(() => buildPromptPayPayload(input({ target: "123" }))).toThrow(
      PromptPayError,
    );
  });
});

describe("การปัดจำนวนเงิน", () => {
  it("เติมทศนิยม 2 ตำแหน่งเสมอ", () => {
    const payload = buildPromptPayPayload(input({ amount: "100" }));
    expect(payload).toContain("5406100.00");
  });

  it("จำนวนเงินที่มีทศนิยมหลักเดียวถูกเติมเป็นสองหลัก", () => {
    expect(buildPromptPayPayload(input({ amount: "4.2" }))).toContain(
      "54044.20",
    );
  });
});
