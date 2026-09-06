import { ERROR_CORRECTION_LEVELS, type ErrorCorrectionLevel } from "./encode";
import { PROMPTPAY_TARGET_TYPES, type PromptPayTargetType } from "./promptpay";
import {
  DEFAULT_QR_STYLE,
  DOT_SHAPES,
  EYE_SHAPES,
  GRADIENT_DIRECTIONS,
  MAX_MARGIN,
  MIN_MARGIN,
  parseHexColor,
  type QrStyle,
} from "./style";
import {
  emptyQrData,
  isQrType,
  type QrData,
  type WifiEncryption,
} from "./types";

/**
 * เก็บสถานะฟอร์มไว้ใน query string เพื่อให้แชร์และบุ๊กมาร์กได้
 * และเป็นฐานของหน้า /qr/[type] ในเฟส SEO
 *
 * ค่าที่ว่างจะไม่ถูกใส่ลง URL เพื่อให้ลิงก์สั้นที่สุดเท่าที่เป็นไปได้
 */

function setIfPresent(
  params: URLSearchParams,
  key: string,
  value: string,
): void {
  if (value.trim() !== "") params.set(key, value);
}

export function qrDataToSearchParams(
  data: QrData,
  level?: ErrorCorrectionLevel,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("type", data.type);

  switch (data.type) {
    case "promptpay":
      if (data.targetType !== "mobile") params.set("target", data.targetType);
      setIfPresent(params, "id", data.target);
      setIfPresent(params, "amount", data.amount);
      break;
    case "url":
      setIfPresent(params, "url", data.url);
      break;
    case "wifi":
      setIfPresent(params, "ssid", data.ssid);
      setIfPresent(params, "password", data.password);
      if (data.encryption !== "WPA") params.set("encryption", data.encryption);
      if (data.hidden) params.set("hidden", "1");
      break;
    case "vcard":
      setIfPresent(params, "firstName", data.firstName);
      setIfPresent(params, "lastName", data.lastName);
      setIfPresent(params, "organization", data.organization);
      setIfPresent(params, "title", data.title);
      setIfPresent(params, "phone", data.phone);
      setIfPresent(params, "email", data.email);
      setIfPresent(params, "website", data.website);
      break;
    case "line":
      setIfPresent(params, "id", data.officialAccountId);
      break;
  }

  if (level !== undefined && level !== "M") params.set("ecc", level);
  return params;
}

function readPromptPayTargetType(value: string | null): PromptPayTargetType {
  return PROMPTPAY_TARGET_TYPES.includes(value as PromptPayTargetType)
    ? (value as PromptPayTargetType)
    : "mobile";
}

function readWifiEncryption(value: string | null): WifiEncryption {
  return value === "WEP" || value === "nopass" ? value : "WPA";
}

export function qrDataFromSearchParams(params: URLSearchParams): QrData | null {
  const rawType = params.get("type");
  if (rawType === null || !isQrType(rawType)) return null;

  const get = (key: string): string => params.get(key) ?? "";

  switch (rawType) {
    case "promptpay":
      return {
        type: "promptpay",
        targetType: readPromptPayTargetType(params.get("target")),
        target: get("id"),
        amount: get("amount"),
      };
    case "url":
      return { type: "url", url: get("url") };
    case "wifi":
      return {
        type: "wifi",
        ssid: get("ssid"),
        password: get("password"),
        encryption: readWifiEncryption(params.get("encryption")),
        hidden: params.get("hidden") === "1",
      };
    case "vcard":
      return {
        type: "vcard",
        firstName: get("firstName"),
        lastName: get("lastName"),
        organization: get("organization"),
        title: get("title"),
        phone: get("phone"),
        email: get("email"),
        website: get("website"),
      };
    case "line":
      return { type: "line", officialAccountId: get("id") };
    default:
      return emptyQrData(rawType);
  }
}

/**
 * ใส่เฉพาะค่าที่ต่างจากค่าเริ่มต้นลง URL เพื่อให้ลิงก์ที่แชร์สั้นที่สุด
 * ใช้ key สั้นเพราะ URL ของ QR มักถูกแชร์ผ่าน LINE ที่ตัดข้อความยาว
 */
export function qrStyleToSearchParams(
  style: QrStyle,
  params: URLSearchParams,
): void {
  const stripHash = (color: string) => color.replace(/^#/, "");

  if (style.ink !== DEFAULT_QR_STYLE.ink) params.set("c", stripHash(style.ink));
  if (style.paper !== DEFAULT_QR_STYLE.paper) {
    params.set("bg", stripHash(style.paper));
  }
  if (style.gradientDirection !== DEFAULT_QR_STYLE.gradientDirection) {
    params.set("g", style.gradientDirection);
    params.set("c2", stripHash(style.inkSecondary));
  }
  if (style.dotShape !== DEFAULT_QR_STYLE.dotShape) {
    params.set("d", style.dotShape);
  }
  if (style.eyeFrameShape !== DEFAULT_QR_STYLE.eyeFrameShape) {
    params.set("ef", style.eyeFrameShape);
  }
  if (style.eyeBallShape !== DEFAULT_QR_STYLE.eyeBallShape) {
    params.set("eb", style.eyeBallShape);
  }
  if (style.margin !== DEFAULT_QR_STYLE.margin) {
    params.set("m", String(style.margin));
  }
}

function pickFrom<T extends string>(
  allowed: readonly T[],
  value: string | null,
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function readColor(value: string | null, fallback: string): string {
  if (value === null) return fallback;
  const withHash = value.startsWith("#") ? value : `#${value}`;
  return parseHexColor(withHash) === null ? fallback : withHash.toLowerCase();
}

export function qrStyleFromSearchParams(params: URLSearchParams): QrStyle {
  const rawMargin = Number(params.get("m"));
  const margin = Number.isFinite(rawMargin)
    ? Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, Math.round(rawMargin)))
    : DEFAULT_QR_STYLE.margin;

  return {
    ink: readColor(params.get("c"), DEFAULT_QR_STYLE.ink),
    paper: readColor(params.get("bg"), DEFAULT_QR_STYLE.paper),
    inkSecondary: readColor(params.get("c2"), DEFAULT_QR_STYLE.inkSecondary),
    gradientDirection: pickFrom(
      GRADIENT_DIRECTIONS,
      params.get("g"),
      DEFAULT_QR_STYLE.gradientDirection,
    ),
    dotShape: pickFrom(DOT_SHAPES, params.get("d"), DEFAULT_QR_STYLE.dotShape),
    eyeFrameShape: pickFrom(
      EYE_SHAPES,
      params.get("ef"),
      DEFAULT_QR_STYLE.eyeFrameShape,
    ),
    eyeBallShape: pickFrom(
      EYE_SHAPES,
      params.get("eb"),
      DEFAULT_QR_STYLE.eyeBallShape,
    ),
    eyeColor: null,
    margin: params.get("m") === null ? DEFAULT_QR_STYLE.margin : margin,
    // โลโก้ไม่อยู่ใน URL — data URI ยาวเกินกว่าจะแชร์ผ่านลิงก์ได้
    logo: null,
  };
}

export function errorCorrectionFromSearchParams(
  params: URLSearchParams,
): ErrorCorrectionLevel {
  const raw = params.get("ecc");
  return ERROR_CORRECTION_LEVELS.includes(raw as ErrorCorrectionLevel)
    ? (raw as ErrorCorrectionLevel)
    : "M";
}
