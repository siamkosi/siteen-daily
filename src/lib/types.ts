import type { ReportDetails } from "./report-details";
export type Project = {
  cover_path?: string | null;
  cover_url?: string;
  id: string;
  workspace_id: string;
  name: string;
  location: string;
  client: string;
  status: "active" | "completed";
  created_at: string;
};
export type Report = {
  report_details?: ReportDetails;
  id: string;
  workspace_id: string;
  project_id: string;
  report_date: string;
  weather: string;
  workers: number;
  work_done: string;
  materials: string;
  equipment: string;
  issues: string;
  tomorrow: string;
  status: "draft" | "submitted" | "cancelled";
  updated_at?: string;
  row_version?: number;
  deleted_at?: string | null;
  deleted_by?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  created_by: string;
  created_at: string;
};
export type Photo = {
  created_at?: string;
  thumbnail_path?: string | null;
  thumbnail_url?: string;
  image_width?: number | null;
  image_height?: number | null;
  byte_size?: number | null;
  thumbnail_byte_size?: number | null;
  source_byte_size?: number | null;
  id: string;
  workspace_id: string;
  project_id: string;
  report_id: string;
  path: string;
  caption: string;
  url?: string;
};
export type Workspace = {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
};
export type Dataset = {
  storage_quota_bytes?: number | null;
  document_events?: DocumentEvent[];
  requests?: Report[];
  projects: Project[];
  reports: Report[];
  photos: Photo[];
};
export type DocumentEvent = {
  id: string;
  workspace_id: string;
  document_kind: "report" | "request";
  document_id: string;
  action:
    "created" | "edited" | "submitted" | "trashed" | "restored" | "cancelled";
  actor_id: string | null;
  occurred_at: string;
  reason?: string | null;
  before_data?: Report | null;
  after_data: Report;
  photos?: Photo[];
};
export function thaiDate(date: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(date.length === 10 ? `${date}T12:00:00+07:00` : date));
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
