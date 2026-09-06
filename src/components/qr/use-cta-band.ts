"use client";

import { useEffect, useState } from "react";
import { frameLayout } from "@/lib/qr/frame";
import {
  BAND_PREVIEW_PIXELS_PER_MODULE,
  type RasterImage,
  rasterizeCtaBand,
} from "@/lib/qr/raster";
import type { QrStyle } from "@/lib/qr/style";

/**
 * วาดแถบข้อความใหม่เมื่อการตั้งค่ากรอบเปลี่ยน
 *
 * ต้องเป็น effect เพราะการวาดตัวอักษรไทยต้องรอฟอนต์โหลดเสร็จก่อน ซึ่งเป็น async
 * ระหว่างที่ยังวาดไม่เสร็จจะยังไม่มีแถบ — preview จึงขึ้นทีละขั้นแทนที่จะกระพริบ
 */
export function useCtaBand(
  matrixSize: number | null,
  style: QrStyle,
): RasterImage | null {
  const [band, setBand] = useState<RasterImage | null>(null);
  const { frame } = style;

  useEffect(() => {
    if (matrixSize === null) {
      setBand(null);
      return;
    }

    const layout = frameLayout(matrixSize, frame);
    if (layout.band === null) {
      setBand(null);
      return;
    }

    let cancelled = false;
    rasterizeCtaBand(
      frame,
      layout.band.width,
      layout.band.height,
      BAND_PREVIEW_PIXELS_PER_MODULE,
    )
      .then((result) => {
        if (!cancelled) setBand(result);
      })
      .catch(() => {
        if (!cancelled) setBand(null);
      });

    return () => {
      cancelled = true;
    };
  }, [matrixSize, frame]);

  return band;
}
