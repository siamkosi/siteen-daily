"use client";
import { useCallback } from "react";
import { reportPhotos } from "./photos";
import type { Photo, Report } from "./types";
import { useRenewingResource } from "./use-renewing-resource";
export function useReportPhotos(
  report: Report,
  demo: boolean,
  demoPhotos: Photo[],
) {
  const { workspace_id, id } = report;
  const load = useCallback(
    (signal: AbortSignal) => reportPhotos(workspace_id, id, signal),
    [workspace_id, id],
  );
  const resource = useRenewingResource(
    `${workspace_id}:${id}`,
    !demo && !report.deleted_at,
    load,
    "โหลดรูปแนบไม่สำเร็จ กรุณาลองโหลดใหม่เพื่อต่ออายุลิงก์ก่อนส่งออก PDF",
  );
  return {
    photos: demo ? demoPhotos : (resource.value ?? []),
    loading: resource.loading,
    error: resource.error,
    refresh: resource.refresh,
    imageError: resource.imageError,
  };
}
