"use client";
import type { DocumentRole } from "@/lib/project-access";
/* eslint-disable @next/next/no-img-element -- Private signed Storage URLs and local demo data URLs. */
import { useState } from "react";
import Link from "next/link";
import { DocumentActions, DocumentHistory } from "./document-lifecycle";
import type { ChangeDocument } from "@/lib/document-lifecycle";
import type { DocumentEvent } from "@/lib/types";
import { useReportPhotos } from "@/lib/use-report-photos";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Download,
  Pencil,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { Photo, Project, Report, thaiDate, today } from "@/lib/types";
import { PageHeading } from "./site-app";
import { ReportDetailsEditor } from "./report-details-editor";
import { ReportPrint } from "./report-print";
import { exportReportPdf } from "@/lib/export-report-pdf";
import { validateRequestTimes } from "@/lib/request-times";
import { DocumentConflictError } from "@/lib/document-concurrency";
import {
  initialEditorDetails,
  progressSummary,
  hourlyWeather,
  workforceTotal,
  validateDetails,
  nextDayReport,
} from "@/lib/report-details";

export function ReportForm({
  projects,
  workspace,
  user,
  save,
  initial: incomingInitial,
  source,
  onCancel,
  kind = "report",
  prefill,
}: {
  projects: Project[];
  workspace: string;
  user: string;
  save: (r: Report) => Promise<void>;
  initial?: Report;
  source?: Report;
  onCancel?: () => void;
  kind?: "report" | "request";
  prefill?: Report;
}) {
  const router = useRouter();
  // Keep the version and fields from the same snapshot for this editing session.
  const [initial] = useState(() =>
    incomingInitial ? structuredClone(incomingInitial) : undefined,
  );
  const values =
    initial ?? prefill ?? (source ? nextDayReport(source) : undefined);
  const request = kind === "request";
  const basePath = request ? "/requests" : "/reports";
  const [details, setDetails] = useState(() => {
    const d = structuredClone(initialEditorDetails(values));
    if (request) d.meta.doc_code = "DRQ";
    return d;
  });
  const legacyWorkers =
    values && !values.report_details?.labor?.length
      ? values.workers
      : undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  if (!projects.length)
    return (
      <div className="panel">
        <h2>สร้างโครงการก่อนเริ่มรายงาน</h2>
        <p>รายงานแต่ละฉบับต้องอยู่ภายใต้โครงการ</p>
        <Link className="button primary" href="/projects">
          ไปสร้างโครงการ
        </Link>
      </div>
    );
  return (
    <>
      <Link href={basePath} className="back-link">
        <ArrowLeft size={16} />
        {request ? "คำขอทั้งหมด" : "รายงานทั้งหมด"}
      </Link>
      <PageHeading
        title={
          request
            ? initial
              ? "แก้ไข Daily Request"
              : "สร้าง Daily Request"
            : initial
              ? "แก้ไขรายงาน"
              : "สร้าง Daily Report"
        }
        description={
          request
            ? "แผนงานขออนุมัติก่อนเริ่มงาน • ให้ผู้ควบคุมงานลงนามใน PDF ภายนอก"
            : "บันทึกสิ่งที่เกิดขึ้นจริงในไซต์งานวันนี้"
        }
      />
      {source && (
        <div className="copy-report-notice" role="status">
          <strong>รายงานวันถัดไป • {thaiDate(values!.report_date)}</strong>
          <p>
            ตั้งต้นจากวันที่ {thaiDate(source.report_date)}{" "}
            โปรดตรวจจำนวนบุคลากรและเครื่องจักรของวันนี้
          </p>
          <p>
            คงชื่อรายการงานและวัสดุไว้ โดยล้างปริมาณ อากาศ ปัญหา หมายเหตุ
            และไม่คัดลอกรูปเดิม
          </p>
        </div>
      )}
      {prefill?.report_details?.meta?.request_reference && (
        <div className="copy-report-notice" role="status">
          <p>
            ตั้งต้นรายการจาก Daily Request{" "}
            {prefill.report_details.meta.request_number} ของวันเดียวกัน
            ล้างจำนวน ชั่วโมง และปริมาณแผนงานแล้ว
            กรุณาบันทึกผลการทำงานจริงก่อนส่งรายงาน
          </p>
          <Link
            href={`/requests/${prefill.report_details.meta.request_reference}`}
          >
            เปิดคำขอต้นฉบับ
          </Link>
        </div>
      )}
      <form
        className="report-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || conflict) return;
          const f = new FormData(e.currentTarget);
          const submitter = (e.nativeEvent as SubmitEvent)
            .submitter as HTMLButtonElement;
          setBusy(true);
          setError("");
          try {
            validateDetails(details);
            if (request) validateRequestTimes(details.progress);
            if (!details.progress.length)
              throw new Error(
                request
                  ? "กรุณาเพิ่มแผนงานขออนุมัติอย่างน้อย 1 รายการ"
                  : "กรุณาเพิ่มรายการงานในตารางความก้าวหน้าอย่างน้อย 1 รายการ",
              );
            const workers = details.labor.length
              ? workforceTotal(details.labor)
              : (legacyWorkers ?? 0);
            const weatherFromClock = hourlyWeather(details.meta);
            const keepLegacyWeather =
              weatherFromClock === null &&
              initial &&
              initial.report_details?.meta?.weather_source !== "hourly";
            const date = String(f.get("report_date"));
            if (!Number.isInteger(workers) || workers < 0 || workers > 10000)
              throw new Error("จำนวนแรงงานต้องเป็นจำนวนเต็ม 0–10,000 คน");
            if (!request && date > today())
              throw new Error("วันที่รายงานต้องไม่เกินวันนี้");
            const report: Report = {
              id: initial?.id ?? crypto.randomUUID(),
              ...(initial ? { row_version: initial.row_version } : {}),
              workspace_id: workspace,
              project_id: values?.project_id ?? String(f.get("project_id")),
              report_date: date,
              weather: request
                ? "ยังไม่บันทึก"
                : (weatherFromClock ??
                  (keepLegacyWeather ? initial.weather : "ยังไม่บันทึก")),
              workers,
              report_details: {
                ...details,
                meta: {
                  ...details.meta,
                  shift: details.meta.shift ?? "day",
                  weather_source: keepLegacyWeather ? "legacy" : "hourly",
                },
              },
              work_done: progressSummary(details.progress),
              materials: String(
                f.get("materials") ?? values?.materials ?? "",
              ).trim(),
              equipment: String(
                f.get("equipment") ?? values?.equipment ?? "",
              ).trim(),
              issues: request
                ? (values?.issues ?? "")
                : String(f.get("issues") ?? "").trim(),
              tomorrow: String(
                f.get("tomorrow") ?? values?.tomorrow ?? "",
              ).trim(),
              status: submitter.value === "submitted" ? "submitted" : "draft",
              created_by: initial?.created_by ?? user,
              created_at: initial?.created_at ?? new Date().toISOString(),
            };
            if (!report.work_done)
              throw new Error("กรุณาระบุรายละเอียดงานในตารางความก้าวหน้า");
            await save(report);
            if (onCancel) onCancel();
            router.push(`${basePath}/${report.id}`);
          } catch (e) {
            if (e instanceof DocumentConflictError) setConflict(true);
            setError(e instanceof Error ? e.message : "บันทึกรายงานไม่สำเร็จ");
          } finally {
            setBusy(false);
          }
        }}
      >
        <nav className="report-section-nav" aria-label="หมวดรายงาน">
          {[
            ["general", "ข้อมูลทั่วไป"],
            ["document", request ? "เอกสาร / ผู้ขอ" : "เอกสาร / อากาศ"],
            ["labor", "บุคลากร"],
            ["equipment", "เครื่องจักร"],
            ["materials", "วัสดุ"],
            ["progress", request ? "แผนงานขออนุมัติ" : "งานวันนี้"],
            ["issues", "ปัญหา / หมายเหตุ"],
          ]
            .filter(
              ([id]) =>
                !request || ["general", "document", "progress"].includes(id),
            )
            .map(([id, label], i) => (
              <a key={id} href={`#report-${id}`}>
                <span>
                  {request && id === "progress"
                    ? "06"
                    : String(i + 1).padStart(2, "0")}
                </span>
                {label}
              </a>
            ))}
        </nav>
        <section id="report-general" className="panel">
          <div className="form-section-title">
            <span>01</span>
            <h2>ข้อมูลทั่วไป</h2>
          </div>
          <div className="form-grid">
            <label>
              โครงการ
              <select
                name="project_id"
                required
                defaultValue={values?.project_id}
                disabled={!!values}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {request ? "วันที่ขอทำงาน" : "วันที่รายงาน"}
              <input
                type="date"
                name="report_date"
                required
                max={request ? undefined : today()}
                defaultValue={values?.report_date ?? today()}
                readOnly={Boolean(
                  prefill?.report_details?.meta?.request_reference,
                )}
              />
            </label>
          </div>
        </section>
        <ReportDetailsEditor
          value={details}
          onChange={setDetails}
          legacyWorkers={legacyWorkers}
          initial={values}
          request={request}
        />
        <div className="form-hint">
          <Camera size={18} />
          {request
            ? "ส่งคำขอคือบันทึกสถานะในระบบ ยังไม่ใช่การอนุมัติหรือส่งอีเมล กรุณาส่ง PDF ให้ผู้ควบคุมงานลงนามภายนอก"
            : "เพิ่มรูปภาพได้หลังบันทึกรายงาน"}
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
            {conflict && initial && (
              <>
                <p>
                  ข้อมูลที่กรอกยังอยู่ในฟอร์มนี้
                  เปิดฉบับล่าสุดเพื่อตรวจสอบและคัดลอกข้อมูลที่ต้องการไปแก้ไขในฉบับล่าสุด
                  ก่อนปิดหรือรีเฟรชหน้านี้
                </p>
                <Link
                  className="button secondary"
                  href={`${basePath}/${initial.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  เปิดฉบับล่าสุดในแท็บใหม่
                </Link>
              </>
            )}
          </div>
        )}
        <div className="form-actions report-save-bar">
          <span className="report-save-caption">
            ตรวจข้อมูลให้ครบ แล้วเลือกบันทึก
          </span>
          {onCancel && (
            <button
              type="button"
              className="button secondary"
              onClick={onCancel}
            >
              ยกเลิก
            </button>
          )}
          <button
            name="status"
            value="draft"
            disabled={busy || conflict || initial?.status === "submitted"}
            className="button secondary"
          >
            <Save size={17} />
            บันทึกฉบับร่าง
          </button>
          <button
            name="status"
            value="submitted"
            disabled={busy || conflict}
            className="button primary"
          >
            <Send size={17} />
            {busy
              ? "กำลังบันทึก…"
              : request
                ? "บันทึกและส่งคำขอ"
                : "บันทึกและส่งรายงาน"}
          </button>
        </div>
      </form>
    </>
  );
}
export function ReportView({
  report,
  project,
  workspaceName,
  photos: initialPhotos,
  demo,
  canEdit,
  save,
  upload,
  removePhoto,
  dailyRequest,
  role,
  user,
  change,
  demoEvents,
}: {
  report: Report;
  project: Project;
  workspaceName: string;
  photos: Photo[];
  demo: boolean;
  canEdit: boolean;
  save: (r: Report) => Promise<void>;
  upload: (
    files: File[],
    caption: string,
    progress: (message: string) => void,
  ) => Promise<void>;
  removePhoto: (photo: Photo) => Promise<void>;
  dailyRequest?: Report;
  role?: DocumentRole;
  user: string;
  change: ChangeDocument;
  demoEvents?: DocumentEvent[];
}) {
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const {
    photos,
    loading: photosLoading,
    error: photoError,
    refresh: refreshPhotos,
    imageError,
  } = useReportPhotos(report, demo, initialPhotos);
  if (report.deleted_at)
    return (
      <>
        <Link className="back-link" href="/trash">
          กลับถังขยะเอกสาร
        </Link>
        <h1>Daily Report • {project.name}</h1>
        <DocumentActions
          report={report}
          kind="report"
          role={role}
          user={user}
          change={change}
        />
        <DocumentHistory
          report={report}
          kind="report"
          user={user}
          demoEvents={demoEvents}
        />
      </>
    );
  if (editing && canEdit)
    return (
      <ReportForm
        projects={[project]}
        workspace={report.workspace_id}
        user={report.created_by}
        initial={report}
        save={save}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <>
      <div className="no-print">
        <Link href="/reports" className="back-link">
          <ArrowLeft size={16} />
          รายงานทั้งหมด
        </Link>
        <PageHeading
          title="Daily Report"
          description={`${project.name} • ${thaiDate(report.report_date)}`}
          action={
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Link
                  className="button secondary"
                  href={`/reports/new?from=${report.id}`}
                >
                  สร้างรายงานวันถัดไป
                </Link>
              )}
              {canEdit && (
                <button
                  className="button secondary"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={16} />
                  แก้ไข
                </button>
              )}
              <button
                className="button primary"
                disabled={exporting || busy || photosLoading || !!photoError}
                aria-busy={exporting}
                onClick={async () => {
                  setExporting(true);
                  setExportError("");
                  try {
                    await exportReportPdf(
                      `${report.report_details?.meta?.report_number || "daily-report"}_${report.report_date}`,
                      {
                        kind: "report",
                        id: report.id,
                        workspaceId: report.workspace_id,
                      },
                    );
                  } catch (e) {
                    setExportError(
                      e instanceof Error ? e.message : "ส่งออก PDF ไม่สำเร็จ",
                    );
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download size={17} />
                {exporting ? "กำลังส่งออก PDF…" : "ส่งออก PDF"}
              </button>
            </div>
          }
        />
        <p className="print-help" role="status">
          ดาวน์โหลด PDF ขนาด A4 พร้อมรูปแนบ • ไม่มีหัว–ท้ายกระดาษของเบราว์เซอร์
        </p>
        {exportError && (
          <p className="error" role="alert">
            {exportError}
          </p>
        )}
      </div>
      <DocumentActions
        report={report}
        kind="report"
        role={role}
        user={user}
        change={change}
      />
      <DocumentHistory
        report={report}
        kind="report"
        user={user}
        demoEvents={demoEvents}
      />
      {photosLoading && (
        <p className="no-print" role="status">
          กำลังโหลดรูปแนบสำหรับรายงาน…
        </p>
      )}
      {photoError && (
        <div className="panel no-print">
          <p className="error" role="alert">
            {photoError}
          </p>
          <button className="button secondary" onClick={refreshPhotos}>
            ลองโหลดรูปแนบใหม่
          </button>
        </div>
      )}
      {dailyRequest && (
        <div className="panel no-print">
          <Link
            className="button secondary"
            href={`/requests/${dailyRequest.id}`}
          >
            เปิด Daily Request ของวันเดียวกัน
          </Link>
          <p>
            Daily Request คือแผนขออนุมัติก่อนทำงาน ส่วน Daily Report
            นี้คือผลการทำงานจริง
          </p>
        </div>
      )}
      {!photosLoading && !photoError && (
        <ReportPrint
          report={report}
          project={project}
          workspaceName={workspaceName}
          photos={photos}
          onPhotoError={imageError}
        />
      )}
      {canEdit && photos.length > 0 && (
        <section className="panel no-print mt-5">
          <h2>จัดการรูปแนบ</h2>
          <div className="photo-grid">
            {photos.map((p) => (
              <figure key={p.id}>
                <img
                  src={p.thumbnail_url || p.url}
                  onError={imageError}
                  alt={p.caption || "ภาพหน้างาน"}
                  loading="lazy"
                />
                <figcaption>{p.caption || "ภาพประกอบรายงาน"}</figcaption>
                <button
                  disabled={busy}
                  type="button"
                  className="text-button danger"
                  onClick={async () => {
                    if (!window.confirm("ลบรูปภาพนี้ถาวร?")) return;
                    setBusy(true);
                    try {
                      await removePhoto(p);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
                    } finally {
                      refreshPhotos();
                      setBusy(false);
                    }
                  }}
                >
                  <Trash2 size={14} />
                  ลบรูป
                </button>
              </figure>
            ))}
          </div>
        </section>
      )}
      {canEdit && (
        <form
          className="panel upload-panel no-print"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const files = f
              .getAll("photos")
              .filter((v): v is File => v instanceof File && v.size > 0);
            if (!files.length) return;
            setBusy(true);
            setError("");
            try {
              await upload(files, String(f.get("caption")), setUploadProgress);
              form.reset();
            } catch (e) {
              setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
            } finally {
              refreshPhotos();
              setUploadProgress("");
              setBusy(false);
            }
          }}
        >
          <h2>
            <Camera size={20} />
            เพิ่มรูปภาพหน้างาน
          </h2>
          <p>
            JPG, PNG, WebP • ก่อนย่อไม่เกิน 20 MB ต่อรูป •
            คำบรรยายใช้กับรูปที่เลือกทั้งหมด
          </p>
          <p>
            ระบบเก็บรูปที่ปรับขนาดสำหรับรายงาน/PDF และภาพตัวอย่างแยกกัน
            ไม่เก็บไฟล์ต้นฉบับจากเครื่อง
          </p>
          <div className="form-grid">
            <label>
              เลือกรูปภาพ
              <input
                type="file"
                name="photos"
                disabled={busy}
                accept="image/jpeg,image/png,image/webp"
                multiple
                required
              />
            </label>
            <label>
              คำบรรยาย
              <input
                name="caption"
                disabled={busy}
                maxLength={500}
                placeholder="เช่น ตรวจเหล็กเสาก่อนเทคอนกรีต"
              />
            </label>
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? "กำลังดำเนินการ…" : "อัปโหลดรูปภาพ"}
          </button>
          {uploadProgress && (
            <p role="status" className="photo-upload-progress">
              {uploadProgress}
            </p>
          )}
        </form>
      )}
      {error && (
        <p className="error no-print" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
