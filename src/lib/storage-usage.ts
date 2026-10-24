import type { Dataset } from "./types";
export const STORAGE_GB = 1_000_000_000;
export const storageMetrics = [
  "total_bytes",
  "total_files",
  "photo_count",
  "report_bytes",
  "thumbnail_bytes",
  "cover_bytes",
  "other_bytes",
  "trash_bytes",
  "cancelled_bytes",
  "unknown_files",
] as const;
export type StorageTotals = Record<(typeof storageMetrics)[number], number>;
export type ProjectStorage = StorageTotals & {
  project_id: string | null;
  project_name: string;
  project_status: string | null;
};
export type StorageSummary = {
  workspace_id: string;
  quota_bytes: number | null;
  warning_percent: number;
  critical_percent: number;
  checked_at: string;
  projects: ProjectStorage[];
  totals: StorageTotals;
};
export function storageLevel(summary: StorageSummary) {
  const quota = summary.quota_bytes;
  if (quota === null) return "unset";
  const percent = (summary.totals.total_bytes / quota) * 100;
  return percent >= 100
    ? "full"
    : percent >= summary.critical_percent
      ? "critical"
      : percent >= summary.warning_percent
        ? "warning"
        : "ok";
}
export function formatStorage(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let unit = 0;
  while (bytes >= 1000 && unit < units.length - 1) {
    bytes /= 1000;
    unit++;
  }
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: unit ? 2 : 0 }).format(bytes)} ${units[unit]}`;
}
export function parseStorageSummary(
  value: unknown,
  workspace: string,
): StorageSummary {
  const s = value as StorageSummary;
  const validTotals = (v: StorageTotals) =>
    v &&
    storageMetrics.every((key) => Number.isSafeInteger(v[key]) && v[key] >= 0);
  if (
    !s ||
    s.workspace_id !== workspace ||
    !validTotals(s.totals) ||
    !Array.isArray(s.projects) ||
    !s.projects.every(
      (p) => typeof p.project_name === "string" && validTotals(p),
    ) ||
    !(
      s.quota_bytes === null ||
      (Number.isSafeInteger(s.quota_bytes) && s.quota_bytes >= 1_000_000)
    ) ||
    s.warning_percent !== 80 ||
    s.critical_percent !== 95 ||
    !Number.isFinite(Date.parse(s.checked_at))
  )
    throw new Error("ข้อมูลพื้นที่จัดเก็บไม่ครบ กรุณาลองใหม่");
  return s;
}
export function emptyStorageTotals(): StorageTotals {
  return Object.fromEntries(storageMetrics.map((k) => [k, 0])) as StorageTotals;
}
function dataUrlSize(url?: string): number | null {
  const match = url?.match(/^data:[^,]*;base64,([\s\S]*)$/);
  return match
    ? Math.floor((match[1].length * 3) / 4) -
        (match[1].endsWith("==") ? 2 : match[1].endsWith("=") ? 1 : 0)
    : null;
}
export function demoStorageSummary(
  data: Dataset,
  workspace: string,
): StorageSummary {
  const rows = data.projects.map((p) => ({
    ...emptyStorageTotals(),
    project_id: p.id,
    project_name: p.name,
    project_status: p.status,
  })) as ProjectStorage[];
  function add(
    project: string,
    kind: "report_bytes" | "thumbnail_bytes" | "cover_bytes",
    bytes: number | null,
    report?: string,
  ) {
    let row = rows.find((p) => p.project_id === project);
    if (!row) row = rows.find((p) => p.project_id === null);
    if (!row) {
      row = {
        ...emptyStorageTotals(),
        project_id: null,
        project_name: "ไฟล์ที่ไม่ผูกกับโครงการ",
        project_status: null,
      };
      rows.push(row);
    }
    row.total_files++;
    if (kind === "report_bytes") row.photo_count++;
    if (bytes === null) row.unknown_files++;
    else {
      row[kind] += bytes;
      row.total_bytes += bytes;
      const r = data.reports.find((r) => r.id === report);
      if (r?.deleted_at) row.trash_bytes += bytes;
      if (r?.status === "cancelled") row.cancelled_bytes += bytes;
    }
  }
  for (const p of data.photos) {
    add(
      p.project_id,
      "report_bytes",
      p.byte_size ?? dataUrlSize(p.url),
      p.report_id,
    );
    if (p.thumbnail_path || p.thumbnail_url)
      add(
        p.project_id,
        "thumbnail_bytes",
        p.thumbnail_byte_size ?? dataUrlSize(p.thumbnail_url),
        p.report_id,
      );
  }
  for (const p of data.projects)
    if (p.cover_url || p.cover_path)
      add(p.id, "cover_bytes", dataUrlSize(p.cover_url));
  const totals = emptyStorageTotals();
  for (const row of rows)
    for (const key of storageMetrics) totals[key] += row[key];
  return {
    workspace_id: workspace,
    quota_bytes: data.storage_quota_bytes ?? null,
    warning_percent: 80,
    critical_percent: 95,
    checked_at: "",
    projects: rows.sort(
      (a, b) =>
        b.total_bytes - a.total_bytes ||
        a.project_name.localeCompare(b.project_name),
    ),
    totals,
  };
}
