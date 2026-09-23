/**
 * โครงของหน้ากฎหมาย
 *
 * ⚠️ ทุกข้อความในโฟลเดอร์นี้ต้องตรงกับสิ่งที่ระบบทำจริงเท่านั้น
 * ห้ามเขียนคำมั่นที่โค้ดไม่ได้ทำ เพราะเอกสารพวกนี้มีผลผูกพันจริง
 * ทุกข้อที่พูดถึงพฤติกรรมของระบบต้องอ้างอิงได้จาก ADR หรือ migration
 *
 * ⚠️ ยังไม่ผ่านการตรวจโดยผู้มีใบอนุญาตว่าความ — docs/roadmap.md ระบุไว้ว่า
 * ต้องให้ทนายตรวจก่อน 19 ต.ค. 2026 ร่างนี้ทำให้สมัคร payment gateway ได้
 * และให้ทนายมีของตั้งต้นที่ตรงกับระบบจริงเพื่อแก้ ไม่ใช่คำแนะนำทางกฎหมาย
 */

export type LegalListItem = { term?: string; detail: string };

export type LegalSection = {
  heading: string;
  body?: string[];
  list?: LegalListItem[];
  /** ตารางสองคอลัมน์ ใช้กับเรื่องที่อ่านเป็นตารางง่ายกว่าอ่านเป็นความ */
  table?: { columns: [string, string]; rows: [string, string][] };
  /** กล่องเน้นสำหรับข้อที่ผู้ใช้เสียหายมากที่สุดถ้าอ่านข้าม */
  callout?: string;
};

export type LegalDocument = {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  lede: string;
  /** วันที่มีผลบังคับใช้ รูปแบบ ISO */
  effectiveDate: string;
  sections: LegalSection[];
};
