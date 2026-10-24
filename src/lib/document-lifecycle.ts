import type { DocumentRole } from "./project-access";
import type { Dataset, Report } from "./types";
export type DocumentKind = "report" | "request";
export type DocumentAction = "trash" | "restore" | "cancel";
export type ChangeDocument = (
  kind: DocumentKind,
  document: Report,
  action: DocumentAction,
  reason?: string,
) => Promise<void>;
export function isActiveDocument(r: Report) {
  return !r.deleted_at && r.status !== "cancelled";
}
export function activeDataset(data: Dataset): Dataset {
  const reports = data.reports.filter(isActiveDocument);
  const ids = new Set(reports.map((r) => r.id));
  return {
    ...data,
    reports,
    requests: (data.requests ?? []).filter(isActiveDocument),
    photos: data.photos.filter((p) => ids.has(p.report_id)),
  };
}
export function restoreDeadline(r: Report) {
  return r.deleted_at
    ? new Date(new Date(r.deleted_at).getTime() + 30 * 86400000)
    : null;
}
export function canTrashDocument(
  r: Report,
  role: DocumentRole | undefined,
  user: string,
) {
  return (
    !r.deleted_at &&
    r.status === "draft" &&
    (role === "owner" || (role === "editor" && r.created_by === user))
  );
}
export function documentStatus(r: Report, kind: DocumentKind = "report") {
  return r.deleted_at
    ? "อยู่ในถังขยะ"
    : r.status === "cancelled"
      ? "ยกเลิกแล้ว"
      : r.status === "draft"
        ? "ฉบับร่าง"
        : kind === "request"
          ? "ส่งคำขอแล้ว"
          : "ส่งรายงานแล้ว";
}
