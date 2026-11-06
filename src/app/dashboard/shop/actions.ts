"use server";

import { revalidatePath } from "next/cache";
import { effectivePlan, toContext } from "@/lib/billing/entitlements";
import { loadSubscription, saveShopPage } from "@/lib/billing/store";
import { generateShortcode } from "@/lib/dynamic/shortcode";
import {
  MAX_LINKS,
  type ShopPageInput,
  validateShopPage,
} from "@/lib/shop/page";
import { createClient } from "@/lib/supabase/server";

export type ShopActionState = {
  status: "idle" | "saved" | "error";
  message: string;
  /** ค่าที่ผู้ใช้พิมพ์ — ส่งกลับตอน error เพราะ React 19 ล้างฟอร์มหลัง submit เอง */
  values?: ShopPageInput;
};

/**
 * บันทึกหน้าร้าน
 *
 * ⚠️ ผู้ใช้มาจาก session เท่านั้น และเช็ค Pro ที่นี่ฝั่งเซิร์ฟเวอร์ก่อนเขียน
 * การซ่อนฟอร์มในหน้าเว็บไม่ใช่การกั้นสิทธิ์
 */
export async function saveShop(
  _previous: ShopActionState,
  formData: FormData,
): Promise<ShopActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { status: "error", message: "เข้าสู่ระบบก่อน" };

  const subscription = await loadSubscription(user.id);
  const plan =
    subscription === null
      ? "free"
      : effectivePlan(
          toContext(
            {
              plan: subscription.plan,
              status: subscription.status,
              grace_until: subscription.graceUntil?.toISOString() ?? null,
            },
            [],
          ),
        );
  if (plan === "free") {
    return { status: "error", message: "หน้าร้านอยู่ในแพ็กเกจ Pro" };
  }

  const text = (key: string) => String(formData.get(key) ?? "");
  const values: ShopPageInput = {
    name: text("name"),
    description: text("description"),
    phone: text("phone"),
    hours: text("hours"),
    links: Array.from({ length: MAX_LINKS }, (_, i) => ({
      label: text(`label${i}`),
      url: text(`url${i}`),
    })),
  };
  const result = validateShopPage(values);
  if (!result.ok) return { status: "error", message: result.message, values };

  // slug เดิมคงไว้ตลอด เพราะอาจพิมพ์เป็น QR ไปแล้ว
  const { data: existing } = await supabase
    .from("shop_pages")
    .select("slug")
    .maybeSingle();

  await saveShopPage(
    user.id,
    existing?.slug ?? generateShortcode(),
    result.value,
  );
  revalidatePath("/dashboard/shop");
  return { status: "saved", message: "บันทึกแล้ว", values: result.value };
}
