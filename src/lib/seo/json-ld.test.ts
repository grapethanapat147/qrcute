import { describe, expect, it } from "vitest";
import {
  breadcrumbSchema,
  faqSchema,
  howToSchema,
  jsonLdGraph,
  organizationSchema,
  serializeJsonLd,
  softwareApplicationSchema,
} from "./json-ld";
import { TYPE_PAGE_LIST } from "./type-pages";
import { USE_CASES } from "./use-cases";

describe("serializeJsonLd", () => {
  /**
   * นี่คือ test ที่สำคัญที่สุดในไฟล์นี้
   * ถ้าไม่หนี `<` ข้อความที่มี "</script>" จะปิดแท็กก่อนเวลา
   * แล้วทุกอย่างหลังจากนั้นกลายเป็น HTML ที่เบราว์เซอร์รันต่อ
   */
  it("หนีอักขระที่ทำให้หลุดออกจาก script tag ได้", () => {
    const out = serializeJsonLd({
      text: "</script><img src=x onerror=alert(1)>",
    });

    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("\\u003c");
  });

  it("ยังเป็น JSON ที่ parse กลับได้เหมือนเดิม", () => {
    const value = { text: "a < b & c > d", th: "ภาษาไทย" };
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });
});

describe("โครงสร้าง schema", () => {
  it("graph ใส่ @context ให้ครั้งเดียวและรวม node ไว้ด้วยกัน", () => {
    const parsed = JSON.parse(
      jsonLdGraph([organizationSchema(), faqSchema([])]),
    );

    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@graph"]).toHaveLength(2);
  });

  it("FAQPage แปลงคำถามครบทุกข้อ", () => {
    const schema = faqSchema([{ question: "ถามอะไร", answer: "ตอบอย่างนี้" }]) as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };

    expect(schema.mainEntity).toHaveLength(1);
    expect(schema.mainEntity[0]?.name).toBe("ถามอะไร");
    expect(schema.mainEntity[0]?.acceptedAnswer.text).toBe("ตอบอย่างนี้");
  });

  it("HowTo ใส่ลำดับขั้นเริ่มที่ 1", () => {
    const schema = howToSchema({
      name: "ทำยังไง",
      steps: [
        { name: "ขั้นแรก", detail: "ทำแบบนี้" },
        { name: "ขั้นสอง", detail: "แล้วทำแบบนี้" },
      ],
    }) as { step: { position: number }[] };

    expect(schema.step.map((s) => s.position)).toEqual([1, 2]);
  });

  it("Breadcrumb คืน URL เต็มไม่ใช่ path", () => {
    const schema = breadcrumbSchema([
      { name: "หน้าแรก", path: "/" },
      { name: "พร้อมเพย์", path: "/qr/promptpay" },
    ]) as { itemListElement: { item: string }[] };

    for (const entry of schema.itemListElement) {
      expect(entry.item).toMatch(/^https?:\/\//);
    }
  });

  /**
   * business invariant ข้อ 2 บอกว่าสร้าง QR พื้นฐานได้โดยไม่ต้องสมัครสมาชิก
   * ถ้าวันหนึ่งเปลี่ยนเป็นต้องสมัครก่อน แต่ยังประกาศราคา 0 ไว้ใน schema
   * เท่ากับประกาศเท็จกับ Google ซึ่งเสี่ยงโดนลงโทษ
   */
  it("SoftwareApplication ประกาศว่าใช้ฟรี", () => {
    const schema = softwareApplicationSchema({
      name: "ทดสอบ",
      description: "คำอธิบาย",
      url: "https://example.test/",
    }) as { offers: { price: string; priceCurrency: string } };

    expect(schema.offers.price).toBe("0");
    expect(schema.offers.priceCurrency).toBe("THB");
  });
});

/**
 * docs/seo.md §4 ห้ามทำหน้าที่เป็น template เปลี่ยนคำเดียว
 * test พวกนี้จับกรณีที่เผลอ copy-paste เนื้อหาข้ามหน้า
 */
describe("เนื้อหาแต่ละหน้าต้องไม่ซ้ำกัน (กัน doorway penalty)", () => {
  const pages = [
    ...TYPE_PAGE_LIST.map((p) => ({
      slug: `/qr/${p.slug}`,
      title: p.title,
      intro: p.intro,
      faq: p.faq,
    })),
    ...USE_CASES.map((p) => ({
      slug: `/use-case/${p.slug}`,
      title: p.title,
      intro: p.intro,
      faq: p.faq,
    })),
  ];

  it("intro ยาวพอตามเกณฑ์ ≥ 150 คำ", () => {
    for (const page of pages) {
      // ไทยไม่เว้นวรรคระหว่างคำ จึงนับอักขระแทน — 150 คำไทยราว 600 อักขระขึ้นไป
      const length = page.intro.join("").length;
      expect(
        length,
        `${page.slug} intro สั้นเกินไป (${length} อักขระ)`,
      ).toBeGreaterThanOrEqual(600);
    }
  });

  it("title ไม่ซ้ำกันเลย", () => {
    const titles = pages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("คำถาม FAQ ไม่ซ้ำข้ามหน้า", () => {
    const seen = new Map<string, string>();

    for (const page of pages) {
      for (const item of page.faq) {
        const previous = seen.get(item.question);
        expect(
          previous,
          `"${item.question}" ซ้ำระหว่าง ${previous} กับ ${page.slug}`,
        ).toBeUndefined();
        seen.set(item.question, page.slug);
      }
    }
  });

  it("ทุกหน้ามี FAQ อย่างน้อย 4 ข้อ", () => {
    for (const page of pages) {
      expect(
        page.faq.length,
        `${page.slug} มี FAQ น้อยเกินไป`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it("หัวข้อส่วนอธิบายของ type page ต้องไม่ใช่ h1 ซ้ำ", () => {
    for (const page of TYPE_PAGE_LIST) {
      expect(page.aboutHeading, `/qr/${page.slug}`).not.toBe(page.h1);
      expect(page.aboutHeading.startsWith(page.h1)).toBe(false);
    }
  });

  it("ย่อหน้าแรกของแต่ละหน้าไม่ซ้ำกัน", () => {
    const openings = pages.map((p) => p.intro[0]);
    expect(new Set(openings).size).toBe(openings.length);
  });
});
