import { PRIVACY } from "./privacy";
import { REFUND } from "./refund";
import { TERMS } from "./terms";
import type { LegalDocument } from "./types";

/**
 * รายการหน้ากฎหมายทั้งหมด
 *
 * sitemap, footer และ route ดึงจากที่นี่ที่เดียว เพิ่มเอกสารใหม่แล้วโผล่ครบเอง
 */
export const LEGAL_DOCUMENTS: LegalDocument[] = [TERMS, PRIVACY, REFUND];

export function findLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.slug === slug);
}

export { PRIVACY, REFUND, TERMS };
export type { LegalDocument } from "./types";
