"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Label, Textarea } from "@/components/ui/input";
import { checkQr, type QrCheckResult } from "@/lib/qr/check";

type Detector = { detect(image: ImageBitmap): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

/**
 * ถอด QR จากรูปด้วย BarcodeDetector ของเบราว์เซอร์ — รูปไม่ถูกส่งออกจากเครื่องผู้ใช้
 * shortcut: Safari บน iPhone ยังไม่มี BarcodeDetector จึงให้วางข้อความแทน, เพิ่มไลบรารีถอด QR (เช่น jsqr) ถ้าคนใช้ iPhone บ่นเยอะ
 */
function getDetector(): Detector | null {
  const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor })
    .BarcodeDetector;
  return Ctor === undefined ? null : new Ctor({ formats: ["qr_code"] });
}

function Verdict({ result }: { result: QrCheckResult }) {
  switch (result.kind) {
    case "empty":
      return null;
    case "embedded":
      return (
        <Box tone="good" title={`${result.label} — ไม่มีวันหมดอายุ`}>
          ข้อมูลอยู่ในตัวภาพทั้งหมด ไม่ได้วิ่งผ่านเว็บของใคร ต่อให้บริการที่ใช้สร้างปิดตัวหรือคุณเลิกจ่าย
          QR นี้ก็ยังใช้งานได้
        </Box>
      );
    case "redirect-service":
      return (
        <Box tone="warn" title={`QR นี้วิ่งผ่าน ${result.host} ก่อนถึงปลายทาง`}>
          {result.host} เป็นบริการย่อลิงก์หรือบริการ QR แบบแก้ปลายทางได้
          ถ้าบริการนี้หยุดให้บริการ หรือคุณหยุดจ่ายค่าแพ็กเกจ QR ที่พิมพ์ไปแล้วอาจหยุดทำงาน
          ถ้าไม่ต้องการแก้ปลายทางทีหลัง{" "}
          <Link href="/qr/url" className="font-medium underline">
            สร้าง QR ที่ฝังลิงก์ตรงฟรี
          </Link>{" "}
          แล้วไม่ต้องพึ่งใคร
        </Box>
      );
    case "ours":
      return (
        <Box tone="info" title="QR แบบแก้ปลายทางได้ของเรา">
          ถ้าหยุดจ่าย QR นี้ยังทำงานต่ออีก 30 วัน
          จากนั้นคนสแกนจะเห็นหน้าคั่นที่ยังกดไปปลายทางเดิมได้ และข้อมูลของคุณไม่ถูกลบ
          ดูรายละเอียดใน{" "}
          <Link href="/pricing" className="font-medium underline">
            หน้าราคา
          </Link>
        </Box>
      );
    case "link":
      return (
        <Box tone="info" title={`QR นี้เก็บลิงก์ไปที่ ${result.host}`}>
          ถ้า {result.host} เป็นเว็บของคุณเอง QR นี้ไม่มีวันหมดอายุ
          แต่ถ้าเป็นโดเมนของบริการที่ใช้สร้าง QR QR อาจหยุดทำงานเมื่อคุณหยุดจ่ายบริการนั้น
        </Box>
      );
  }
}

function Box({
  tone,
  title,
  children,
}: {
  tone: "good" | "warn" | "info";
  title: string;
  children: React.ReactNode;
}) {
  const border = {
    good: "border-success",
    warn: "border-warning",
    info: "border-primary",
  }[tone];
  return (
    <output className={`block rounded-lg border-l-4 ${border} bg-muted/40 p-5`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </output>
  );
}

export function QrChecker({ ownHost }: { ownHost: string }) {
  const fileId = useId();
  const textId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function readImage(file: File) {
    setError(null);
    const detector = getDetector();
    if (detector === null) {
      setError(
        "เบราว์เซอร์นี้อ่าน QR จากรูปไม่ได้ ใช้กล้องมือถือสแกน แล้วคัดลอกลิงก์หรือข้อความมาวางในช่องด้านล่างแทน",
      );
      return;
    }
    try {
      const found = await detector.detect(await createImageBitmap(file));
      if (found.length === 0) {
        setError("ไม่เจอ QR ในรูปนี้ ลองครอปให้เห็น QR ชัด ๆ แล้วอัปโหลดใหม่");
        return;
      }
      setText(found[0]?.rawValue ?? "");
    } catch {
      setError("อ่านรูปนี้ไม่ได้ ลองใช้ไฟล์ PNG หรือ JPG");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor={fileId}>อัปโหลดรูป QR ที่ใช้อยู่</Label>
        <input
          id={fileId}
          type="file"
          accept="image/*"
          className="block w-full text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) void readImage(file);
          }}
        />
        <p className="text-sm text-muted-foreground">
          รูปไม่ถูกส่งออกจากเครื่องของคุณ การอ่าน QR เกิดในเบราว์เซอร์ทั้งหมด
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={textId}>หรือวางลิงก์/ข้อความที่สแกนได้</Label>
        <Textarea
          id={textId}
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="https://..."
        />
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Verdict result={checkQr(text, ownHost)} />
    </div>
  );
}
