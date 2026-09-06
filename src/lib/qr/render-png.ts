import type { QrMatrix } from "./encode";

export const PNG_SIZES = [512, 1024, 2048] as const;
export type PngSize = (typeof PNG_SIZES)[number];

export type PngLayout = {
  /** ขนาดจริงของ canvas */
  canvasSize: number;
  /** กี่ px ต่อหนึ่ง module — เป็นจำนวนเต็มเสมอ */
  modulePixels: number;
  /** ระยะเยื้องเพื่อจัดกึ่งกลางเมื่อหารไม่ลงตัว */
  offset: number;
};

/**
 * คำนวณเลย์เอาต์ก่อนวาด
 *
 * ปัดขนาด module ลงเป็นจำนวนเต็มเสมอ แล้วจัดกึ่งกลางส่วนที่เหลือ
 * ถ้าปล่อยให้เป็นทศนิยม ขอบ module จะตกคร่อม pixel แล้วเบลอ
 * ซึ่งเป็นสาเหตุอันดับต้น ๆ ที่ QR พิมพ์ออกมาแล้วสแกนไม่ติด
 */
export function computePngLayout(
  matrixSize: number,
  targetSize: number,
): PngLayout {
  const modulePixels = Math.max(1, Math.floor(targetSize / matrixSize));
  const drawnSize = modulePixels * matrixSize;
  return {
    canvasSize: targetSize,
    modulePixels,
    offset: Math.floor((targetSize - drawnSize) / 2),
  };
}

export type PngRenderOptions = {
  size: number;
  ink?: string;
  paper?: string;
};

export function drawMatrixToCanvas(
  canvas: HTMLCanvasElement,
  matrix: QrMatrix,
  options: PngRenderOptions,
): void {
  const { size, ink = "#000000", paper = "#ffffff" } = options;
  const layout = computePngLayout(matrix.size, size);

  canvas.width = layout.canvasSize;
  canvas.height = layout.canvasSize;

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("เบราว์เซอร์นี้ไม่รองรับ canvas 2d context");
  }

  context.fillStyle = paper;
  context.fillRect(0, 0, layout.canvasSize, layout.canvasSize);
  context.fillStyle = ink;

  for (let y = 0; y < matrix.size; y += 1) {
    const row = matrix.data[y];
    if (row === undefined) continue;

    let runStart = -1;
    for (let x = 0; x <= matrix.size; x += 1) {
      const filled = x < matrix.size && row[x] === true;
      if (filled && runStart === -1) {
        runStart = x;
      } else if (!filled && runStart !== -1) {
        context.fillRect(
          layout.offset + runStart * layout.modulePixels,
          layout.offset + y * layout.modulePixels,
          (x - runStart) * layout.modulePixels,
          layout.modulePixels,
        );
        runStart = -1;
      }
    }
  }
}

/** วาด matrix ลง canvas แล้วคืนเป็น PNG blob — ใช้ได้เฉพาะฝั่ง browser */
export async function renderPngBlob(
  matrix: QrMatrix,
  options: PngRenderOptions,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawMatrixToCanvas(canvas, matrix, options);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error("แปลง canvas เป็น PNG ไม่สำเร็จ"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
