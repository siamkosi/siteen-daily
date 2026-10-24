"use client";
/* eslint-disable @next/next/no-img-element -- Private signed preview URLs. */
import Link from "next/link";
import { useCallback, useState } from "react";
import { useRenewingResource } from "@/lib/use-renewing-resource";
import {
  demoPhotoPage,
  galleryPhotoPage,
  type PhotoFilters,
} from "@/lib/photos";
import { type Photo, type Project, type Report, thaiDate } from "@/lib/types";

export function PhotoGallery({
  workspace,
  demo,
  photos,
  reports,
  projects,
}: {
  workspace: string;
  demo: boolean;
  photos: Photo[];
  reports: Report[];
  projects: Project[];
}) {
  const [project, setProject] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const filters = { project, from, to, page };
  const invalid = !!from && !!to && from > to;
  return (
    <>
      <div className="photo-filters">
        <label>
          โครงการ
          <select
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setPage(0);
            }}
          >
            <option value="">ทุกโครงการ</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          วันที่รายงาน ตั้งแต่
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          วันที่รายงาน ถึง
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      <p className="photo-gallery-help">
        แสดงครั้งละ 24 รูป • กรองตามวันที่ของ Daily Report
      </p>
      {invalid ? (
        <p className="error" role="alert">
          วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด
        </p>
      ) : (
        <GalleryPage
          key={`${workspace}:${project}:${from}:${to}:${page}`}
          workspace={workspace}
          demo={demo}
          photos={photos}
          reports={reports}
          projects={projects}
          filters={filters}
          setPage={setPage}
        />
      )}
    </>
  );
}

function GalleryPage({
  workspace,
  demo,
  photos,
  reports,
  projects,
  filters,
  setPage,
}: {
  workspace: string;
  demo: boolean;
  photos: Photo[];
  reports: Report[];
  projects: Project[];
  filters: PhotoFilters;
  setPage: (page: number) => void;
}) {
  const { project, from, to, page } = filters;
  const load = useCallback(
    (signal: AbortSignal) =>
      galleryPhotoPage(workspace, { project, from, to, page }, signal),
    [workspace, project, from, to, page],
  );
  const { value, error, refresh, imageError } = useRenewingResource(
    `${workspace}:${project}:${from}:${to}:${page}`,
    !demo,
    load,
    "โหลดหรือต่ออายุลิงก์รูปไม่สำเร็จ กรุณาลองใหม่",
  );
  const current = demo ? demoPhotoPage(photos, reports, filters) : value;
  // Remove cached metadata immediately when the caller confirms lost access.
  const allowed = new Set(projects.map((p) => p.id));
  const visiblePhotos = current?.photos.filter((p) =>
    allowed.has(p.project_id),
  );
  return (
    <>
      {error && (
        <div className="panel">
          <p className="error" role="alert">
            {error}
          </p>
          <button className="button secondary" onClick={refresh}>
            ลองโหลดรูปใหม่
          </button>
        </div>
      )}
      {!current && !error && <p role="status">กำลังโหลดรูปหน้านี้…</p>}
      <div className="gallery-grid" aria-busy={!current && !error}>
        {visiblePhotos?.map((p) => (
          <Link
            className="gallery-card"
            key={p.id}
            href={`/reports/${p.report_id}`}
          >
            <img
              src={p.thumbnail_url || p.url}
              alt={p.caption || "ภาพหน้างาน"}
              loading="lazy"
              decoding="async"
              onError={imageError}
            />
            <div>
              <h3>{p.caption || "ภาพหน้างาน"}</h3>
              <p>{projects.find((x) => x.id === p.project_id)?.name}</p>
              <small>{thaiDate(p.report_date)}</small>
            </div>
          </Link>
        ))}
      </div>
      {current && !visiblePhotos?.length && (
        <div className="empty">ไม่พบรูปตามโครงการและช่วงวันที่ที่เลือก</div>
      )}
      <nav className="photo-pagination" aria-label="เปลี่ยนหน้ารูปภาพ">
        <button
          className="button secondary"
          disabled={page === 0 || !current}
          onClick={() => setPage(page - 1)}
        >
          หน้าก่อนหน้า
        </button>
        <span aria-live="polite">
          หน้า {page + 1}
          {current ? ` • ${visiblePhotos?.length ?? 0} รูป` : ""}
        </span>
        <button
          className="button secondary"
          disabled={!current?.hasNext}
          onClick={() => setPage(page + 1)}
        >
          หน้าถัดไป
        </button>
      </nav>
    </>
  );
}
