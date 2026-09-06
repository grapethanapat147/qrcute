"use client";

import { useEffect, useState } from "react";

/**
 * หน่วงค่าไว้ก่อนส่งต่อ
 *
 * ใช้กับ preview เพื่อไม่ให้ encode QR ใหม่ทุกตัวอักษรที่พิมพ์
 * 200ms สั้นพอที่ยังรู้สึกว่า "อัปเดตทันที" แต่ยาวพอให้พิมพ์รัวแล้วไม่กระตุก
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
