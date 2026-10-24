import type { Report } from "./types";
export type LaborRow = {
  group: "staff" | "daily" | "subcontract";
  label: string;
  count: number;
  hours: number;
};
export type EquipmentRow = {
  kind: "machine" | "tool";
  label: string;
  count: number;
  hours: number;
};
export type ProgressRow = {
  time: string;
  description: string;
  unit: string;
  quantity: number | null;
};
export type MaterialRow = {
  label: string;
  kind: "used" | "received";
  quantity: number | null;
  unit: string;
  notes: string;
};
export type ReportDetails = {
  material_rows?: MaterialRow[];
  version: 1;
  meta: Record<string, string>;
  labor: LaborRow[];
  equipment: EquipmentRow[];
  progress: ProgressRow[];
};
export const emptyDetails = (): ReportDetails => ({
  version: 1,
  meta: {},
  labor: [],
  equipment: [],
  progress: [],
});
export const laborGroups = {
  staff: "พนักงานปฏิบัติการ",
  daily: "พนักงานรายวัน",
  subcontract: "ผู้รับเหมา",
};
export function rounded(n: number) {
  return Math.round(n * 100) / 100;
}
export function laborTotal(rows: LaborRow[]) {
  return rows.reduce((n, r) => n + r.count, 0);
}
export function manHours(rows: LaborRow[]) {
  return rounded(rows.reduce((n, r) => n + r.count * r.hours, 0));
}
// Report workforce excludes operational staff; group subtotals still include all rows.
export function workforceTotal(rows: LaborRow[]) {
  return laborTotal(rows.filter((r) => r.group !== "staff"));
}
export function workforceHours(rows: LaborRow[]) {
  return manHours(rows.filter((r) => r.group !== "staff"));
}
export function validateDetails(d: ReportDetails) {
  if (d.labor.length > 50 || d.equipment.length > 40 || d.progress.length > 60)
    throw new Error(
      "จำนวนรายการเกินขีดจำกัด (บุคลากร 50 / เครื่องจักร 40 / งาน 60)",
    );
  for (const r of [...d.labor, ...d.equipment]) {
    if (!r.label.trim() || r.label.length > 200)
      throw new Error("กรุณาระบุชื่อรายการ ไม่เกิน 200 ตัวอักษร");
    if (
      !Number.isInteger(r.count) ||
      r.count < 0 ||
      r.count > 10000 ||
      !Number.isFinite(r.hours) ||
      r.hours < 0 ||
      r.hours > 24
    )
      throw new Error("จำนวนต้องเป็นจำนวนเต็ม 0–10,000 และชั่วโมง 0–24");
  }
  if (laborTotal(d.labor) > 10000)
    throw new Error("จำนวนแรงงานรวมต้องไม่เกิน 10,000 คน");
  for (const r of d.progress)
    if (
      !r.description.trim() ||
      r.description.length > 1000 ||
      r.time.length > 50 ||
      r.unit.length > 30 ||
      (r.quantity !== null &&
        (!Number.isFinite(r.quantity) || r.quantity < 0 || r.quantity > 1e9))
    )
      throw new Error(
        "ตรวจรายการงาน: รายละเอียดไม่เกิน 1,000 ตัวอักษร และปริมาณต้องไม่ติดลบ",
      );
  if ((d.material_rows?.length ?? 0) > 40)
    throw new Error("วัสดุไม่เกิน 40 รายการ");
  for (const r of d.material_rows ?? []) {
    if (
      !r.label.trim() ||
      r.label.length > 200 ||
      !["used", "received"].includes(r.kind) ||
      !r.unit.trim() ||
      r.unit.length > 30 ||
      r.notes.length > 300 ||
      (r.quantity !== null &&
        (!Number.isFinite(r.quantity) || r.quantity < 0 || r.quantity > 1e9))
    )
      throw new Error(
        "ตรวจวัสดุ: ระบุชื่อและหน่วย จำนวนต้องไม่ติดลบ หมายเหตุไม่เกิน 300 ตัวอักษร",
      );
  }
  for (const [k, v] of Object.entries(d.meta))
    if (v.length > (["solution", "notes"].includes(k) ? 10000 : 300))
      throw new Error("ข้อมูลหัวเอกสารหรือหมายเหตุยาวเกินกำหนด");
}

export const weatherOptions = [
  { value: "แดดออก", label: "แจ่มใส", color: "#ffffff" },
  { value: "มีเมฆมาก", label: "มีเมฆมาก", color: "#00aeef" },
  { value: "ฝนตก", label: "ฝนตกเล็กน้อย", color: "#a6a6a6" },
  { value: "ฝนตกหนัก / หยุดงาน", label: "ฝนตกหนัก", color: "#ed1c24" },
];

// Keep existing reports' selected-shift period while offering separate day/night ranges.
export function shiftDetails(meta: Record<string, string>) {
  const shift = meta.shift ?? "";
  return {
    day: shift === "day" || shift === "both",
    night: shift === "night" || shift === "both",
    dayPeriod:
      meta.day_period ??
      ((shift === "day" || shift === "both") && meta.work_period
        ? meta.work_period
        : "08:00–17:00"),
    nightPeriod:
      meta.night_period ??
      (shift === "night" && meta.work_period
        ? meta.work_period
        : "18:00–21:00"),
  };
}

// Only the structured progress table is editable; this bounded text is its list summary.
export function progressSummary(rows: ProgressRow[]) {
  const text = rows
    .map((r) => r.description.trim())
    .filter(Boolean)
    .join("\n");
  if (text.length <= 10000) return text;
  const suffix = "\n(ดูรายการงานทั้งหมดในตารางความก้าวหน้า)";
  let summary = "";
  for (const char of text) {
    if (summary.length + char.length > 10000 - suffix.length) break;
    summary += char;
  }
  return summary + suffix;
}
export function hourlyWeather(meta: Record<string, string>): string | null {
  const counts = new Map<string, number>();
  for (let h = 6; h < 18; h++) {
    const value = meta[`weather_${String(h).padStart(2, "0")}`];
    if (weatherOptions.some((w) => w.value === value))
      counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let result: string | null = null,
    highest = 0;
  // Most recorded hours wins; a tie uses the wetter condition.
  for (const w of weatherOptions) {
    const count = counts.get(w.value) ?? 0;
    if (count > 0 && count >= highest) {
      result = w.value;
      highest = count;
    }
  }
  return result;
}
export function initialEditorDetails(initial?: {
  report_details?: ReportDetails;
  work_done?: string;
}): ReportDetails {
  const details =
    initial?.report_details?.version === 1
      ? initial.report_details
      : initial
        ? emptyDetails()
        : newReportDetails();
  if (details.progress.length) return details;
  const text = initial?.work_done?.trim() ?? "";
  const chunks: string[] = [];
  let chunk = "";
  for (const char of text) {
    if (chunk.length + char.length > 1000) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) chunks.push(chunk);
  return {
    ...details,
    progress: (chunks.length ? chunks : [""]).map((description) => ({
      time: "",
      description,
      unit: "",
      quantity: null,
    })),
  };
}

export const disciplineOptions = [
  "งานโครงสร้าง",
  "งานสถาปัตย์",
  "งานภูมิสถาปัตย์และงานภายนอก",
] as const;
export function selectedDiscipline(value = "") {
  const text = value.trim();
  const aliases: Record<string, string> = {
    โครงสร้าง: "งานโครงสร้าง",
    สถาปัตย์: "งานสถาปัตย์",
    สถาปัตยกรรม: "งานสถาปัตย์",
    งานสถาปัตยกรรม: "งานสถาปัตย์",
    ภูมิสถาปัตย์: "งานภูมิสถาปัตย์และงานภายนอก",
    งานภูมิสถาปัตย์: "งานภูมิสถาปัตย์และงานภายนอก",
  };
  return aliases[text] ?? text;
}

// The approved print layout is shared by all reports; these are new-document defaults.
export function newReportDetails(): ReportDetails {
  return {
    ...emptyDetails(),
    meta: {
      doc_code: "DRP",
      revision: "0",
      shift: "day",
      day_period: "08:00–17:00",
      night_period: "18:00–21:00",
    },
  };
}
export function nextReportDate(date: string) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
export function nextDayReport(source: Report): Report {
  const details = structuredClone(initialEditorDetails(source));
  for (const key of Object.keys(details.meta))
    if (/^weather_\d{2}$/.test(key)) delete details.meta[key];
  Object.assign(details.meta, {
    weather_source: "hourly",
    notes: "",
    solution: "",
    revision: "0",
  });
  const number = details.meta.report_number ?? "";
  details.meta.report_number = /\d+-\d{4}$/.test(number)
    ? number.replace(
        /(\d+)(-\d{4})$/,
        (_, sequence, year) =>
          String(Number(sequence) + 1).padStart(sequence.length, "0") + year,
      )
    : "";
  details.progress = details.progress.map((row) => ({
    ...row,
    time: "",
    quantity: null,
  }));
  details.material_rows = (details.material_rows ?? []).map((row) => ({
    ...row,
    quantity: null,
    notes: "",
  }));
  return {
    ...source,
    id: "",
    report_date: nextReportDate(source.report_date),
    status: "draft",
    weather: "ยังไม่บันทึก",
    materials: "",
    equipment: "",
    issues: "",
    tomorrow: "",
    created_by: "",
    created_at: "",
    report_details: details,
  };
}
