import { buildPromptPayPayload } from "./promptpay";
import type { QrData, WifiEncryption } from "./types";

/**
 * แปลงข้อมูลที่ผู้ใช้กรอก → payload string ที่จะฝังใน QR
 * และแปลงกลับได้ (parsePayload) เพื่อใช้ทดสอบ round-trip
 *
 * รูปแบบ payload อ้างอิงจากมาตรฐาน/de-facto standard ของแต่ละประเภท
 * ไม่ใช่รูปแบบที่เราคิดขึ้นเอง — เครื่องสแกนต้องอ่านได้โดยไม่ต้องรู้จักเว็บเรา
 */

const LINE_OA_PREFIX = "https://line.me/R/ti/p/";

// ---------------------------------------------------------------------------
// helper: escape / unescape
// ---------------------------------------------------------------------------

/** WiFi payload ต้อง escape `\ ; , : "` ด้วย backslash */
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

/** vCard escape ตาม RFC 6350: `\ ; ,` และขึ้นบรรทัดใหม่ */
function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function unescapeVCard(value: string): string {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (ch === "\\") {
      const next = value[i + 1];
      if (next === undefined) break;
      out += next === "n" || next === "N" ? "\n" : next;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** แยกสตริงด้วยตัวคั่น โดยข้ามตัวคั่นที่ถูก escape ไว้ */
function splitUnescaped(value: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (ch === "\\") {
      current += ch + (value[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (ch === separator) {
      parts.push(current);
      current = "";
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  parts.push(current);
  return parts;
}

/** ตัดอักขระที่ใช้ไม่ได้ใน tel: URI ออก (เว้นวรรค ขีด วงเล็บ) */
export function normalizePhone(value: string): string {
  return value.replace(/[\s\-()]/g, "");
}

/** ถ้าผู้ใช้ไม่ได้พิมพ์ scheme ให้เติม https:// ให้ */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** LINE Official Account ID ต้องขึ้นต้นด้วย @ */
export function normalizeLineId(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

function buildVCard(data: Extract<QrData, { type: "vcard" }>): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCard(data.lastName)};${escapeVCard(data.firstName)};;;`,
    `FN:${escapeVCard(`${data.firstName} ${data.lastName}`.trim())}`,
  ];
  if (data.organization) lines.push(`ORG:${escapeVCard(data.organization)}`);
  if (data.title) lines.push(`TITLE:${escapeVCard(data.title)}`);
  if (data.phone) lines.push(`TEL;TYPE=CELL:${normalizePhone(data.phone)}`);
  if (data.email) lines.push(`EMAIL:${escapeVCard(data.email)}`);
  if (data.website) lines.push(`URL:${normalizeUrl(data.website)}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export function buildPayload(data: QrData): string {
  switch (data.type) {
    case "promptpay":
      return buildPromptPayPayload(data);

    case "url":
      return normalizeUrl(data.url);

    case "wifi": {
      const parts = [`T:${data.encryption}`, `S:${escapeWifi(data.ssid)}`];
      if (data.encryption !== "nopass") {
        parts.push(`P:${escapeWifi(data.password)}`);
      }
      if (data.hidden) parts.push("H:true");
      return `WIFI:${parts.join(";")};;`;
    }

    case "line": {
      const id = normalizeLineId(data.officialAccountId);
      return id === "" ? "" : `${LINE_OA_PREFIX}${encodeURIComponent(id)}`;
    }

    case "vcard":
      return buildVCard(data);
  }
}

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

function parseWifiFields(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && body[i] === ";") i += 1;
    if (i >= body.length) break;

    let key = "";
    while (i < body.length && body[i] !== ":" && body[i] !== ";") {
      key += body[i];
      i += 1;
    }
    if (i >= body.length || body[i] !== ":") break;
    i += 1;

    let value = "";
    while (i < body.length) {
      const ch = body[i];
      if (ch === "\\") {
        value += body[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (ch === ";") break;
      value += ch;
      i += 1;
    }
    if (key !== "") fields.set(key, value);
  }
  return fields;
}

function parseWifi(payload: string): QrData {
  const fields = parseWifiFields(payload.slice("WIFI:".length));
  const rawEncryption = fields.get("T") ?? "WPA";
  const encryption: WifiEncryption =
    rawEncryption === "WEP" || rawEncryption === "nopass"
      ? rawEncryption
      : "WPA";
  return {
    type: "wifi",
    ssid: fields.get("S") ?? "",
    password: encryption === "nopass" ? "" : (fields.get("P") ?? ""),
    encryption,
    hidden: fields.get("H") === "true",
  };
}

function parseVCard(payload: string): QrData {
  const result = {
    type: "vcard" as const,
    firstName: "",
    lastName: "",
    organization: "",
    title: "",
    phone: "",
    email: "",
    website: "",
  };

  for (const line of payload.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const name = line.slice(0, separatorIndex).split(";")[0]?.toUpperCase();
    const value = line.slice(separatorIndex + 1);

    switch (name) {
      case "N": {
        const parts = splitUnescaped(value, ";");
        result.lastName = unescapeVCard(parts[0] ?? "");
        result.firstName = unescapeVCard(parts[1] ?? "");
        break;
      }
      case "ORG":
        result.organization = unescapeVCard(value);
        break;
      case "TITLE":
        result.title = unescapeVCard(value);
        break;
      case "TEL":
        result.phone = unescapeVCard(value);
        break;
      case "EMAIL":
        result.email = unescapeVCard(value);
        break;
      case "URL":
        result.website = value;
        break;
      default:
        break;
    }
  }

  return result;
}

/**
 * แปลง payload กลับเป็นข้อมูลที่ผู้ใช้กรอก
 *
 * ใช้ใน round-trip test เป็นหลัก — ถ้าแปลงกลับไม่ตรง แปลว่า escape ผิด
 * คืน null เมื่อเป็น payload ที่เราไม่ได้สร้าง (เช่น QR ของเว็บอื่น)
 *
 * หมายเหตุ: ไม่รองรับพร้อมเพย์ เพราะความถูกต้องของพร้อมเพย์พิสูจน์ด้วย
 * golden vector ใน promptpay.test.ts ซึ่งแข็งแรงกว่า round-trip
 */
export function parsePayload(payload: string): QrData | null {
  if (payload.startsWith("WIFI:")) return parseWifi(payload);
  if (payload.startsWith("BEGIN:VCARD")) return parseVCard(payload);
  if (payload.startsWith(LINE_OA_PREFIX)) {
    return {
      type: "line",
      officialAccountId: decodeURIComponent(
        payload.slice(LINE_OA_PREFIX.length),
      ),
    };
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(payload)) {
    return { type: "url", url: payload };
  }
  return null;
}
