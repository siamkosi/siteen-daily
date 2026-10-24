import assert from "node:assert/strict";
import {
  requestTimeParts,
  validateRequestTimes,
} from "../src/lib/request-times.ts";
assert.deepEqual(requestTimeParts("8.00-17.30 น."), {
  start: "08:00",
  end: "17:30",
});
assert.deepEqual(requestTimeParts("22:00–02:00"), {
  start: "22:00",
  end: "02:00",
});
validateRequestTimes([{ time: "22:00–02:00" }]);
for (const time of ["", "08:00", "08:00–", "25:00–17:00", "08:00–08:00"])
  assert.throws(() => validateRequestTimes([{ time }]));
import {
  emptyDetails,
  laborTotal,
  manHours,
  validateDetails,
  workforceTotal,
  workforceHours,
  shiftDetails,
  progressSummary,
  hourlyWeather,
  initialEditorDetails,
  selectedDiscipline,
  disciplineOptions,
  nextDayReport,
  nextReportDate,
} from "../src/lib/report-details.ts";
const d = emptyDetails();
d.labor = [
  { group: "staff", label: "วิศวกร", count: 1, hours: 8 },
  { group: "daily", label: "ช่าง", count: 8, hours: 7.5 },
  { group: "subcontract", label: "ผู้รับเหมา", count: 5, hours: 8 },
];
d.equipment = [{ kind: "machine", label: "รถขุด", count: 2, hours: 6 }];
d.progress = [
  { time: "08:00–12:00", description: "งานตัวอย่าง", unit: "ฐาน", quantity: 0 },
];
validateDetails(d);
assert.equal(laborTotal(d.labor), 14);
assert.equal(manHours(d.labor), 108);
assert.equal(workforceTotal(d.labor), 13);
assert.equal(workforceHours(d.labor), 100);
assert.equal(workforceTotal([d.labor[0]]), 0);
assert.equal(workforceHours([d.labor[0]]), 0);
assert.throws(() =>
  validateDetails({ ...d, labor: [{ ...d.labor[0], count: -1 }] }),
);
assert.throws(() =>
  validateDetails({ ...d, equipment: [{ ...d.equipment[0], hours: 25 }] }),
);
assert.throws(() =>
  validateDetails({ ...d, progress: [{ ...d.progress[0], quantity: -1 }] }),
);
assert.throws(() =>
  validateDetails({
    ...d,
    labor: [
      { ...d.labor[0], count: 10000 },
      { ...d.labor[1], count: 1 },
    ],
  }),
);
validateDetails({ ...d, progress: [{ ...d.progress[0], quantity: null }] });
console.log(
  "PASS: grouped labor totals, man-hours, zero/unspecified quantities, negative/range validation",
);

assert.equal(
  shiftDetails({ shift: "day", work_period: "8.00-17.00" }).dayPeriod,
  "8.00-17.00",
);
assert.equal(shiftDetails({ shift: "day" }).night, false);
assert.equal(
  shiftDetails({ shift: "night", work_period: "19:00–23:00" }).nightPeriod,
  "19:00–23:00",
);
assert.equal(shiftDetails({ shift: "both" }).day, true);
assert.equal(shiftDetails({ shift: "both" }).night, true);
assert.equal(
  shiftDetails({ shift: "", night_period: "20:00–23:00" }).night,
  false,
);

assert.equal(hourlyWeather({}), null);
assert.equal(
  hourlyWeather({ weather_06: "แดดออก", weather_07: "ฝนตก" }),
  "ฝนตก",
);
assert.equal(
  hourlyWeather({
    weather_06: "แดดออก",
    weather_07: "แดดออก",
    weather_08: "ฝนตก",
  }),
  "แดดออก",
);
assert.equal(hourlyWeather({ weather_06: "unknown" }), null);
assert.equal(initialEditorDetails().progress.length, 1);
const legacyText = "ข้อความเดิม😀".repeat(850);
const imported = initialEditorDetails({ work_done: legacyText });
assert.equal(imported.progress.map((r) => r.description).join(""), legacyText);
assert.ok(imported.progress.every((r) => r.description.length <= 1000));
validateDetails(imported);
assert.equal(
  initialEditorDetails({ report_details: d, work_done: "ข้อความซ้ำ" }),
  d,
);
assert.equal(progressSummary(d.progress), "งานตัวอย่าง");
const manyRows = Array.from({ length: 20 }, () => ({
  ...d.progress[0],
  description: "งาน".repeat(300),
}));
assert.ok(progressSummary(manyRows).length <= 10000);
assert.ok(
  progressSummary(manyRows).endsWith("(ดูรายการงานทั้งหมดในตารางความก้าวหน้า)"),
);
assert.equal(manyRows[0].description.length, 900);
console.log(
  "PASS: single-source progress, legacy import, hourly weather and bounded summary",
);

const material = {
  label: "คอนกรีต",
  kind: "received",
  quantity: 12.5,
  unit: "ลบ.ม.",
  notes: "ทดสอบ",
};
validateDetails({ ...d, material_rows: [material] });
for (const patch of [
  { quantity: -1 },
  { unit: "" },
  { kind: "invalid" },
  { label: "" },
])
  assert.throws(() =>
    validateDetails({ ...d, material_rows: [{ ...material, ...patch }] }),
  );
console.log("PASS: material quantities, units and type validation");

assert.equal(selectedDiscipline("โครงสร้าง"), "งานโครงสร้าง");
assert.equal(selectedDiscipline("สถาปัตยกรรม"), "งานสถาปัตย์");
assert.equal(
  selectedDiscipline("งานภูมิสถาปัตย์"),
  "งานภูมิสถาปัตย์และงานภายนอก",
);
for (const value of disciplineOptions)
  assert.equal(selectedDiscipline(value), value);
assert.equal(selectedDiscipline("ข้อความเดิมอื่น"), "ข้อความเดิมอื่น");
console.log("PASS: discipline options and legacy labels");

assert.equal(initialEditorDetails().meta.doc_code, "DRP");
assert.equal(initialEditorDetails().meta.shift, "day");
assert.equal(nextReportDate("2026-12-31"), "2027-01-01");
assert.equal(nextReportDate("2028-02-28"), "2028-02-29");
const source = {
  id: "original",
  report_date: "2026-10-22",
  status: "submitted",
  weather: "ฝนตก",
  materials: "เก่า",
  equipment: "เก่า",
  issues: "เก่า",
  tomorrow: "เก่า",
  created_by: "owner",
  created_at: "old",
  work_done: "งานเดิม",
  report_details: {
    ...structuredClone(d),
    meta: {
      ...d.meta,
      report_number: "HTH-27EN-ACE-DRP-041-2569",
      weather_08: "ฝนตก",
      notes: "เก่า",
      logo_set: "hampton",
    },
    material_rows: [{ ...material, quantity: 100 }],
  },
};
const beforeCopy = JSON.stringify(source);
const copied = nextDayReport(source);
assert.equal(copied.id, "");
assert.equal(copied.report_date, "2026-10-23");
assert.equal(copied.status, "draft");
assert.equal(
  copied.report_details.meta.report_number,
  "HTH-27EN-ACE-DRP-042-2569",
);
assert.equal(copied.report_details.meta.logo_set, "hampton");
assert.equal(copied.report_details.meta.weather_08, undefined);
assert.equal(copied.report_details.meta.notes, "");
assert.equal(copied.report_details.progress[0].quantity, null);
assert.equal(copied.report_details.material_rows[0].quantity, null);
assert.deepEqual(copied.report_details.labor, source.report_details.labor);
copied.report_details.labor[0].count = 9;
assert.equal(JSON.stringify(source), beforeCopy);
console.log(
  "PASS: approved defaults, next-day dates/sequence, cleared daily facts and independent copy",
);
