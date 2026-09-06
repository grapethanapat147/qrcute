import { ERROR_CORRECTION_LEVELS, type ErrorCorrectionLevel } from "./encode";
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
    case "url":
      setIfPresent(params, "url", data.url);
      break;
    case "text":
      setIfPresent(params, "text", data.text);
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
    case "tel":
      setIfPresent(params, "phone", data.phone);
      break;
    case "sms":
      setIfPresent(params, "phone", data.phone);
      setIfPresent(params, "message", data.message);
      break;
    case "email":
      setIfPresent(params, "to", data.to);
      setIfPresent(params, "subject", data.subject);
      setIfPresent(params, "body", data.body);
      break;
    case "line":
      setIfPresent(params, "id", data.officialAccountId);
      break;
  }

  if (level !== undefined && level !== "M") params.set("ecc", level);
  return params;
}

function readWifiEncryption(value: string | null): WifiEncryption {
  return value === "WEP" || value === "nopass" ? value : "WPA";
}

export function qrDataFromSearchParams(params: URLSearchParams): QrData | null {
  const rawType = params.get("type");
  if (rawType === null || !isQrType(rawType)) return null;

  const get = (key: string): string => params.get(key) ?? "";

  switch (rawType) {
    case "url":
      return { type: "url", url: get("url") };
    case "text":
      return { type: "text", text: get("text") };
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
    case "tel":
      return { type: "tel", phone: get("phone") };
    case "sms":
      return { type: "sms", phone: get("phone"), message: get("message") };
    case "email":
      return {
        type: "email",
        to: get("to"),
        subject: get("subject"),
        body: get("body"),
      };
    case "line":
      return { type: "line", officialAccountId: get("id") };
    default:
      return emptyQrData(rawType);
  }
}

export function errorCorrectionFromSearchParams(
  params: URLSearchParams,
): ErrorCorrectionLevel {
  const raw = params.get("ecc");
  return ERROR_CORRECTION_LEVELS.includes(raw as ErrorCorrectionLevel)
    ? (raw as ErrorCorrectionLevel)
    : "M";
}
