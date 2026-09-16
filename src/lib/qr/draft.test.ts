import { describe, expect, it } from "vitest";
import {
  addDraft,
  clearDrafts,
  DRAFT_STORAGE_KEY,
  type DraftStorage,
  MAX_DRAFTS,
  type QrDraft,
  readDrafts,
  stripLogo,
  suggestTitle,
} from "./draft";
import { DEFAULT_QR_STYLE } from "./style";
import type { QrData } from "./types";

function fakeStorage(initial: Record<string, string> = {}): DraftStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

function makeDraft(id: string): QrDraft {
  return {
    id,
    title: `ร้าน ${id}`,
    data: { type: "url", url: "https://example.com" },
    style: DEFAULT_QR_STYLE,
    level: "M",
    createdAt: "2026-09-07T00:00:00.000Z",
  };
}

describe("stripLogo", () => {
  it("ตัดโลโก้ออกเพราะ data URI ใหญ่เกินกว่าจะเก็บ", () => {
    const withLogo = {
      ...DEFAULT_QR_STYLE,
      logo: { src: "data:image/png;base64,AAAA", sizeRatio: 0.2 },
    };
    expect(stripLogo(withLogo).logo).toBeNull();
  });

  it("ไม่สร้าง object ใหม่ถ้าไม่มีโลโก้อยู่แล้ว", () => {
    expect(stripLogo(DEFAULT_QR_STYLE)).toBe(DEFAULT_QR_STYLE);
  });

  it("ไม่แตะค่าอื่นในสไตล์", () => {
    const styled = {
      ...DEFAULT_QR_STYLE,
      ink: "#123a75",
      logo: { src: "data:image/png;base64,AAAA", sizeRatio: 0.2 },
    };
    expect(stripLogo(styled).ink).toBe("#123a75");
  });
});

describe("readDrafts", () => {
  it("ไม่มีอะไรเก็บไว้ก็คืนรายการว่าง", () => {
    expect(readDrafts(fakeStorage())).toEqual([]);
  });

  it("ข้อมูลเสียต้องไม่ทำให้หน้าพัง", () => {
    expect(
      readDrafts(fakeStorage({ [DRAFT_STORAGE_KEY]: "{ไม่ใช่ json" })),
    ).toEqual([]);
    expect(
      readDrafts(fakeStorage({ [DRAFT_STORAGE_KEY]: '"ไม่ใช่อาร์เรย์"' })),
    ).toEqual([]);
  });

  it("กรองรายการที่รูปแบบไม่ครบทิ้ง", () => {
    const storage = fakeStorage({
      [DRAFT_STORAGE_KEY]: JSON.stringify([makeDraft("a"), { id: "b" }, null]),
    });
    expect(readDrafts(storage)).toHaveLength(1);
  });

  it("localStorage ที่โยน error (โหมดส่วนตัว) ต้องไม่ทำให้พัง", () => {
    const storage: DraftStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(readDrafts(storage)).toEqual([]);
  });
});

describe("addDraft", () => {
  it("ของใหม่อยู่บนสุด", () => {
    const storage = fakeStorage();
    addDraft(storage, makeDraft("a"));
    const result = addDraft(storage, makeDraft("b"));
    expect(result.map((draft) => draft.id)).toEqual(["b", "a"]);
  });

  it("เก็บไม่เกินโควตา และตัดของเก่าที่สุดทิ้ง", () => {
    const storage = fakeStorage();
    for (let index = 0; index < MAX_DRAFTS + 5; index += 1) {
      addDraft(storage, makeDraft(String(index)));
    }
    const stored = readDrafts(storage);
    expect(stored).toHaveLength(MAX_DRAFTS);
    expect(stored[0]?.id).toBe(String(MAX_DRAFTS + 4));
  });

  it("เขียนไม่ได้ก็ไม่โยน error ออกไปกวนผู้ใช้", () => {
    const storage: DraftStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {},
    };
    expect(() => addDraft(storage, makeDraft("a"))).not.toThrow();
  });
});

describe("clearDrafts", () => {
  it("ลบทิ้งทั้งหมด", () => {
    const storage = fakeStorage();
    addDraft(storage, makeDraft("a"));
    clearDrafts(storage);
    expect(readDrafts(storage)).toEqual([]);
  });
});

describe("suggestTitle", () => {
  const cases: Array<{ data: QrData; expected: string }> = [
    {
      data: {
        type: "promptpay",
        targetType: "mobile",
        target: "0801234567",
        amount: "",
      },
      expected: "พร้อมเพย์ 0801234567",
    },
    {
      data: { type: "url", url: "https://example.com/menu" },
      expected: "example.com/menu",
    },
    {
      data: {
        type: "wifi",
        ssid: "ร้านกาแฟ",
        password: "x",
        encryption: "WPA",
        hidden: false,
      },
      expected: "WiFi ร้านกาแฟ",
    },
    {
      data: { type: "line", officialAccountId: "@cafe" },
      expected: "LINE @cafe",
    },
  ];

  for (const testCase of cases) {
    it(`ตั้งชื่อให้ประเภท ${testCase.data.type}`, () => {
      expect(suggestTitle(testCase.data)).toBe(testCase.expected);
    });
  }

  it("ชื่อจากลิงก์ยาวถูกตัดไม่ให้ล้น", () => {
    const long = `https://example.com/${"ก".repeat(200)}`;
    expect(suggestTitle({ type: "url", url: long }).length).toBeLessThanOrEqual(
      60,
    );
  });
});
