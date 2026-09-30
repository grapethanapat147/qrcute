"use client";

import { useEffect, useState } from "react";
import {
  effectivePlan,
  type Plan,
  toContext,
} from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/client";

/**
 * แพ็กเกจที่ผู้เปิดหน้านี้ใช้อยู่จริง ณ ตอนนี้
 *
 * ทำไมต้องอ่านฝั่ง client ทั้งที่อ่านฝั่ง server ง่ายกว่า:
 * หน้า / และ /qr/[type] เป็น static ทั้งหมด ถ้าให้ page อ่าน session
 * ทุกหน้าจะกลายเป็น dynamic ทันที ซึ่งทิ้ง SSG ที่เป็นหัวใจของ SEO และ CWV
 * แลกกับการกั้นปุ่มดาวน์โหลด — ไม่คุ้มเลย
 *
 * คืน "free" ทันทีโดยไม่ยิงอะไรถ้ายังไม่ได้ล็อกอิน จึงไม่กระทบ
 * business invariant ข้อ 2 ที่ว่าต้องสร้าง QR ได้ใน 5 วินาทีโดยไม่ต้องสมัคร
 *
 * ⚠️ นี่ไม่ใช่การบังคับสิทธิ์ ดูเหตุผลใน src/lib/billing/plan-gate.ts
 */
export function useViewerPlan(): Plan {
  const [plan, setPlan] = useState<Plan>("free");

  useEffect(() => {
    let active = true;

    async function resolve() {
      const supabase = createClient();

      // อ่านจาก storage ก่อน ไม่ยิงเน็ต — คนที่ไม่ได้ล็อกอินจบตรงนี้
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session === null) return;

      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan, status, grace_until")
        .maybeSingle();

      if (!active || error !== null || data === null) return;

      setPlan(effectivePlan(toContext(data, [], new Date())));
    }

    void resolve();
    return () => {
      active = false;
    };
  }, []);

  return plan;
}
