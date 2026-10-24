import { today, type Report } from "./types";
import { initialEditorDetails } from "./report-details";

export function latestProjectReport(
  reports: Report[],
  projectId: string,
  workspaceId: string,
) {
  return reports
    .filter((r) => r.project_id === projectId && r.workspace_id === workspaceId)
    .sort(
      (a, b) =>
        b.report_date.localeCompare(a.report_date) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    )[0];
}

export function requestFromReport(source: Report, workDate = today()): Report {
  const details = structuredClone(initialEditorDetails(source));
  for (const key of Object.keys(details.meta)) {
    if (
      key.startsWith("weather_") ||
      key.startsWith("request_") ||
      key.startsWith("source_report_")
    )
      delete details.meta[key];
  }
  const number = source.report_details?.meta?.report_number ?? "";
  Object.assign(details.meta, {
    doc_code: "DRQ",
    revision: "0",
    notes: "",
    solution: "",
    report_number: number.includes("DRP") ? number.replace(/DRP/g, "DRQ") : "",
    source_report_id: source.id,
    source_report_number: number || source.id,
    source_report_date: source.report_date,
  });
  // Actual work/holiday notes are deliberately not copied into the new plan.
  details.progress = [{ time: "", description: "", unit: "", quantity: null }];
  details.labor = [];
  details.equipment = [];
  details.material_rows = [];
  return {
    ...source,
    id: "",
    report_date: workDate,
    status: "draft",
    weather: "ยังไม่บันทึก",
    work_done: "",
    workers: 0,
    materials: "",
    equipment: "",
    issues: "",
    tomorrow: "",
    created_at: "",
    created_by: "",
    report_details: details,
  };
}

// Copy planned task labels as a starting point; actual quantities must be entered.
export function reportFromRequest(request: Report): Report {
  const details = structuredClone(initialEditorDetails(request));
  details.meta.doc_code = "DRP";
  details.meta.report_number = (details.meta.report_number ?? "").replace(
    /DRQ/g,
    "DRP",
  );
  details.meta.request_reference = request.id;
  details.meta.request_number =
    request.report_details?.meta?.report_number || request.id;
  details.meta.notes = "";
  details.meta.solution = "";
  for (const key of Object.keys(details.meta))
    if (key.startsWith("weather_")) delete details.meta[key];
  details.labor = details.labor.map((row) => ({ ...row, count: 0, hours: 0 }));
  details.equipment = details.equipment.map((row) => ({
    ...row,
    count: 0,
    hours: 0,
  }));
  details.progress = details.progress.map((row) => ({
    ...row,
    quantity: null,
    time: "",
  }));
  details.material_rows = (details.material_rows ?? []).map((row) => ({
    ...row,
    quantity: null,
    notes: "",
  }));
  return {
    ...request,
    id: "",
    status: "draft",
    workers: 0,
    weather: "ยังไม่บันทึก",
    materials: "",
    equipment: "",
    issues: "",
    tomorrow: "",
    report_details: details,
  };
}
