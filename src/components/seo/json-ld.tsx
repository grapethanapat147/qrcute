import { jsonLdGraph } from "@/lib/seo/json-ld";

/**
 * ใส่ JSON-LD ลงในหน้า
 *
 * ใช้ dangerouslySetInnerHTML เพราะ React จะ escape เครื่องหมายคำพูดจนกลายเป็น
 * JSON ที่ parser อ่านไม่ออกถ้าใส่เป็น children ปกติ ความปลอดภัยมาจาก
 * serializeJsonLd ที่หนี `<` `>` `&` ไว้แล้ว ไม่ใช่จากตรงนี้
 */
export function JsonLd({ nodes }: { nodes: Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD ต้องเป็นเนื้อหาดิบ ความปลอดภัยมาจาก serializeJsonLd
      dangerouslySetInnerHTML={{ __html: jsonLdGraph(nodes) }}
    />
  );
}
