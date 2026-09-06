/**
 * เรขาคณิตกลางของ QR
 *
 * ใช้คำสั่งแค่ 4 แบบ (M / L / C / Z) ซึ่งเป็นชุดที่ทั้ง SVG และ PDF รองรับตรงกัน
 * จงใจไม่ใช้คำสั่งวาดส่วนโค้ง (A ของ SVG) เพราะ PDF ไม่มีคำสั่งนั้น
 * ถ้าใช้ A จะต้องมีโค้ดวาดรูปทรงสองชุดแล้วค่อย ๆ เพี้ยนจากกัน
 */

export type PathCommand =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | {
      op: "C";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x: number;
      y: number;
    }
  | { op: "Z" };

/**
 * อัตราส่วนจุดควบคุมของ Bézier ที่ประมาณส่วนโค้ง 90° ได้ใกล้เคียงที่สุด
 * ค่าคลาสสิก 4/3 × (√2 − 1)
 */
const KAPPA = 0.5522847498307936;

export type Radii = [number, number, number, number];

/**
 * สี่เหลี่ยมที่กำหนดรัศมีมุมได้ทีละมุม (บนซ้าย, บนขวา, ล่างขวา, ล่างซ้าย)
 *
 * ถ้ารัศมีทุกมุมเท่ากับครึ่งหนึ่งของด้าน จะได้วงกลม — จึงไม่ต้องมีฟังก์ชันวงกลมแยก
 */
export function roundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: Radii,
): PathCommand[] {
  const limit = Math.min(width, height) / 2;
  const [tl, tr, br, bl] = radii.map((radius) =>
    Math.max(0, Math.min(radius, limit)),
  ) as Radii;

  const right = x + width;
  const bottom = y + height;
  const commands: PathCommand[] = [{ op: "M", x: x + tl, y }];

  commands.push({ op: "L", x: right - tr, y });
  if (tr > 0) {
    commands.push({
      op: "C",
      x1: right - tr + KAPPA * tr,
      y1: y,
      x2: right,
      y2: y + tr - KAPPA * tr,
      x: right,
      y: y + tr,
    });
  }

  commands.push({ op: "L", x: right, y: bottom - br });
  if (br > 0) {
    commands.push({
      op: "C",
      x1: right,
      y1: bottom - br + KAPPA * br,
      x2: right - br + KAPPA * br,
      y2: bottom,
      x: right - br,
      y: bottom,
    });
  }

  commands.push({ op: "L", x: x + bl, y: bottom });
  if (bl > 0) {
    commands.push({
      op: "C",
      x1: x + bl - KAPPA * bl,
      y1: bottom,
      x2: x,
      y2: bottom - bl + KAPPA * bl,
      x,
      y: bottom - bl,
    });
  }

  // ข้ามเส้นปิดท้ายเมื่อมุมบนซ้ายไม่มีความโค้ง เพราะจุดปลายจะทับจุดเริ่มต้นพอดี
  // และคำสั่ง Z ปิดรูปให้อยู่แล้ว — ช่วยลดขนาดไฟล์ของกรณีสี่เหลี่ยมล้วนที่ใช้บ่อยสุด
  if (tl > 0) {
    commands.push({ op: "L", x, y: y + tl });
    commands.push({
      op: "C",
      x1: x,
      y1: y + tl - KAPPA * tl,
      x2: x + tl - KAPPA * tl,
      y2: y,
      x: x + tl,
      y,
    });
  }

  commands.push({ op: "Z" });
  return commands;
}

/** ตัดทศนิยมที่ไม่จำเป็นทิ้ง และห้ามใช้สัญกรณ์ยกกำลัง (PDF อ่านไม่ออก) */
export function formatNumber(value: number, decimals = 4): string {
  const rounded = Number(value.toFixed(decimals));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function toSvgPathData(commands: PathCommand[]): string {
  const n = formatNumber;
  return commands
    .map((command) => {
      switch (command.op) {
        case "M":
          return `M${n(command.x)} ${n(command.y)}`;
        case "L":
          return `L${n(command.x)} ${n(command.y)}`;
        case "C":
          return `C${n(command.x1)} ${n(command.y1)} ${n(command.x2)} ${n(command.y2)} ${n(command.x)} ${n(command.y)}`;
        case "Z":
          return "Z";
        default:
          // ไปไม่ถึงจริง — TypeScript ตรวจครบทุกกรณีให้แล้ว แต่ linter มองไม่เห็น
          throw new Error("คำสั่งเส้นทางที่ไม่รู้จัก");
      }
    })
    .join("");
}

/** แปลงเป็น operator ของ PDF — m / l / c / h ตามลำดับเดียวกับ SVG */
export function toPdfPathData(commands: PathCommand[]): string {
  const n = formatNumber;
  return commands
    .map((command) => {
      switch (command.op) {
        case "M":
          return `${n(command.x)} ${n(command.y)} m`;
        case "L":
          return `${n(command.x)} ${n(command.y)} l`;
        case "C":
          return `${n(command.x1)} ${n(command.y1)} ${n(command.x2)} ${n(command.y2)} ${n(command.x)} ${n(command.y)} c`;
        case "Z":
          return "h";
        default:
          throw new Error("คำสั่งเส้นทางที่ไม่รู้จัก");
      }
    })
    .join("\n");
}
