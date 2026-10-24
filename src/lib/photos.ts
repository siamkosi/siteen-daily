import { supabase } from "./supabase";
import type { Photo, Report } from "./types";
import type { PreparedPhoto } from "./prepare-photo";
import { SIGNED_IMAGE_TTL_SECONDS } from "./signed-image-policy";
export const PHOTO_PAGE_SIZE = 24;
export type PhotoFilters = {
  project: string;
  from: string;
  to: string;
  page: number;
};
export type GalleryPhoto = Photo & { report_date: string };

export async function signPhotoPaths(
  paths: string[],
): Promise<Map<string, string>> {
  if (!supabase) throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
  const unique = [...new Set(paths)];
  const urls = new Map<string, string>();
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await supabase.storage
      .from("site-photos")
      .createSignedUrls(unique.slice(i, i + 100), SIGNED_IMAGE_TTL_SECONDS);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.error || !item.path || !item.signedUrl)
        throw new Error("เปิดรูปไม่สำเร็จ กรุณาลองโหลดใหม่");
      urls.set(item.path, item.signedUrl);
    }
  }
  if (unique.some((p) => !urls.has(p)))
    throw new Error("เปิดรูปไม่ครบ กรุณาลองโหลดใหม่");
  return urls;
}

async function signedPhotos<T extends Photo>(
  photos: T[],
  previewOnly = false,
): Promise<T[]> {
  if (!supabase || !photos.length) return photos;
  const paths = [
    ...new Set(
      photos.flatMap((p) =>
        previewOnly
          ? [p.thumbnail_path || p.path]
          : [p.path, ...(p.thumbnail_path ? [p.thumbnail_path] : [])],
      ),
    ),
  ];
  const urls = await signPhotoPaths(paths);
  return photos.map((p) => ({
    ...p,
    url: previewOnly ? undefined : urls.get(p.path),
    thumbnail_url: urls.get(p.thumbnail_path || p.path),
  }));
}

// Query only the visible page. The join filters by report date, not upload date.
export async function galleryPhotoPage(
  workspace: string,
  filters: PhotoFilters,
  signal?: AbortSignal,
): Promise<{ photos: GalleryPhoto[]; hasNext: boolean }> {
  if (!supabase) throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
  let query = supabase
    .from("photos")
    .select("*,daily_reports!inner(report_date,status,deleted_at)")
    .eq("workspace_id", workspace)
    .is("daily_reports.deleted_at", null)
    .neq("daily_reports.status", "cancelled");
  if (filters.project) query = query.eq("project_id", filters.project);
  if (filters.from)
    query = query.gte("daily_reports.report_date", filters.from);
  if (filters.to) query = query.lte("daily_reports.report_date", filters.to);
  const offset = filters.page * PHOTO_PAGE_SIZE;
  query = query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PHOTO_PAGE_SIZE);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Photo & {
    daily_reports: { report_date: string };
  })[];
  const photos = rows
    .slice(0, PHOTO_PAGE_SIZE)
    .map(({ daily_reports, ...photo }) => ({
      ...photo,
      report_date: daily_reports.report_date,
    }));
  return {
    photos: await signedPhotos(photos, true),
    hasNext: rows.length > PHOTO_PAGE_SIZE,
  };
}

export async function reportPhotos(
  workspace: string,
  report: string,
  signal?: AbortSignal,
): Promise<Photo[]> {
  if (!supabase) throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
  const photos: Photo[] = [];
  for (let offset = 0; ; offset += 100) {
    let query = supabase
      .from("photos")
      .select("*")
      .eq("workspace_id", workspace)
      .eq("report_id", report)
      .order("created_at")
      .order("id")
      .range(offset, offset + 99);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    photos.push(...(data as Photo[]));
    if (data.length < 100) break;
  }
  return signedPhotos(photos);
}

export async function storePreparedPhoto(
  photo: Photo,
  prepared: PreparedPhoto,
) {
  if (!supabase || !photo.thumbnail_path)
    throw new Error("ยังไม่พร้อมอัปโหลดรูป");
  const bucket = supabase.storage.from("site-photos");
  const stored: string[] = [];
  try {
    for (const [path, blob] of [
      [photo.path, prepared.image],
      [photo.thumbnail_path, prepared.thumbnail],
    ] as const) {
      const { error } = await bucket.upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) throw error;
      stored.push(path);
    }
    const { error } = await supabase.from("photos").insert(photo);
    if (error) throw error;
  } catch (error) {
    if (stored.length) {
      const cleanup = await bucket.remove(stored);
      if (cleanup.error)
        throw new Error(
          "บันทึกรูปไม่สำเร็จและเก็บกวาดไฟล์ที่อัปโหลดค้างไม่ได้ กรุณาแจ้ง Owner ก่อนลองใหม่",
        );
    }
    throw error;
  }
}

export function demoPhotoPage(
  photos: Photo[],
  reports: Report[],
  filters: PhotoFilters,
) {
  const active = new Map(
    reports
      .filter((r) => !r.deleted_at && r.status !== "cancelled")
      .map((r) => [r.id, r]),
  );
  const rows = photos
    .flatMap((p) => {
      const report = active.get(p.report_id);
      return report &&
        (!filters.project || p.project_id === filters.project) &&
        (!filters.from || report.report_date >= filters.from) &&
        (!filters.to || report.report_date <= filters.to)
        ? [{ ...p, report_date: report.report_date }]
        : [];
    })
    .sort(
      (a, b) =>
        (b.created_at || b.report_date).localeCompare(
          a.created_at || a.report_date,
        ) || b.id.localeCompare(a.id),
    );
  return {
    photos: rows.slice(
      filters.page * PHOTO_PAGE_SIZE,
      (filters.page + 1) * PHOTO_PAGE_SIZE,
    ),
    hasNext: rows.length > (filters.page + 1) * PHOTO_PAGE_SIZE,
  };
}
