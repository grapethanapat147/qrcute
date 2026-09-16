import { absoluteUrl, siteConfig } from "@/lib/site";
import type { FaqItem } from "./type-pages";

/**
 * ตัวสร้าง JSON-LD ตามตารางใน docs/seo.md §5
 *
 * รวมไว้ที่เดียวเพราะทุกหน้าต้องประกาศ Organization และ URL ชุดเดียวกัน
 * ถ้าแต่ละหน้าเขียนเอง จะเพี้ยนกันทีละนิดจนตัว validator บ่นโดยไม่มีใครเห็น
 *
 * ทุกอันต้องผ่าน Rich Results Test ก่อน deploy (docs/seo.md §8)
 */

type Json = Record<string, unknown>;

const ORGANIZATION_ID = absoluteUrl("/#organization");
const WEBSITE_ID = absoluteUrl("/#website");

export function organizationSchema(): Json {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: siteConfig.name,
    url: absoluteUrl("/"),
    description: siteConfig.description,
  };
}

export function websiteSchema(): Json {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: siteConfig.name,
    url: absoluteUrl("/"),
    inLanguage: siteConfig.defaultLanguage,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/**
 * SoftwareApplication — ใช้กับหน้าแรกและหน้า /qr/[type]
 *
 * offers ราคา 0 เพราะสร้าง QR พื้นฐานได้ฟรีจริงโดยไม่ต้องสมัคร (business invariant ข้อ 2)
 * ถ้าวันหนึ่งบังคับให้สมัครก่อน ต้องแก้ตรงนี้ด้วย ไม่งั้นเป็นการประกาศเท็จกับ Google
 */
export function softwareApplicationSchema(input: {
  name: string;
  description: string;
  url: string;
}): Json {
  return {
    "@type": "SoftwareApplication",
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    inLanguage: siteConfig.defaultLanguage,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "THB",
    },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function faqSchema(items: FaqItem[]): Json {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function howToSchema(input: {
  name: string;
  steps: { name: string; detail: string }[];
}): Json {
  return {
    "@type": "HowTo",
    name: input.name,
    inLanguage: siteConfig.defaultLanguage,
    step: input.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.detail,
    })),
  };
}

export function breadcrumbSchema(
  trail: { name: string; path: string }[],
): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * รวมหลาย schema เป็นก้อนเดียวด้วย @graph
 *
 * ดีกว่าใส่ <script> หลายตัวเพราะ node อ้างถึงกันด้วย @id ได้
 * เช่น SoftwareApplication ชี้กลับไปหา Organization ตัวเดียวกัน
 */
export function jsonLdGraph(nodes: Json[]): string {
  return serializeJsonLd({ "@context": "https://schema.org", "@graph": nodes });
}

/**
 * แปลงเป็นสตริงที่ปลอดภัยพอจะใส่ใน <script>
 *
 * ⚠️ ต้องหนี `<` เป็น < เสมอ ไม่งั้นข้อความที่มี "</script>" อยู่ข้างใน
 * จะปิดแท็กก่อนเวลาแล้วกลายเป็นช่องให้ฝังสคริปต์ได้
 * เนื้อหาของเรามาจากไฟล์ในโปรเจกต์ก็จริง แต่กันไว้ที่ชั้นนี้ราคาถูกกว่ามาก
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
