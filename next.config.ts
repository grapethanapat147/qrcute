import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * มี bun.lock อยู่ใน home directory ด้วย ทำให้ Turbopack เดา workspace root ผิด
   * ล็อกไว้ที่โฟลเดอร์โปรเจกต์เพื่อให้ build บนเครื่อง dev กับบน CI ได้ผลเหมือนกัน
   */
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
