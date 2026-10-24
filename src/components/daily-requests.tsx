"use client";
import Link from "next/link";
import { useState } from "react";
import { Dataset, Report, thaiDate, today } from "@/lib/types";
import { ReportForm } from "./reports";
import { RequestPrint } from "./request-print";
import { exportReportPdf } from "@/lib/export-report-pdf";
import { latestProjectReport, requestFromReport } from "@/lib/daily-request";
import { DocumentActions, DocumentHistory } from "./document-lifecycle";
import {
  activeDataset,
  documentStatus,
  isActiveDocument,
  type ChangeDocument,
} from "@/lib/document-lifecycle";
import type { DocumentEvent, Workspace } from "@/lib/types";

export function DailyDocuments({ data }: { data: Dataset }) {
  const date = today();
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2>เอกสารประจำวันที่วิศวกรสนามต้องจัดทำ</h2>
      <p>
        <b>ก่อนเริ่มงาน:</b> Daily Request ระบุงาน เวลาเริ่ม และเวลาเสร็จ ส่ง
        PDF ให้ผู้ควบคุมงานลงนาม
      </p>
      <p>
        <b>หลังทำงาน:</b> Daily Report บันทึกผลจริง ปัญหา
        และรูปหน้างานของวันเดียวกัน
      </p>
      <p>
        สถานะส่งคำขอแล้วหมายถึงจัดทำในระบบ ยังไม่ยืนยันการส่งต่อหรือลงนามภายนอก
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>โครงการ / {thaiDate(date)}</th>
              <th>Daily Request</th>
              <th>Daily Report</th>
            </tr>
          </thead>
          <tbody>
            {data.projects
              .filter((p) => p.status === "active")
              .map((p) => {
                const request = (data.requests ?? []).find(
                  (r) => r.project_id === p.id && r.report_date === date,
                );
                const report = data.reports.find(
                  (r) => r.project_id === p.id && r.report_date === date,
                );
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      {request ? (
                        <Link href={`/requests/${request.id}`}>
                          {request.status === "submitted"
                            ? "ส่งคำขอแล้ว"
                            : "ฉบับร่าง"}
                        </Link>
                      ) : (
                        "ยังไม่ได้จัดทำ"
                      )}
                    </td>
                    <td>
                      {report ? (
                        <Link href={`/reports/${report.id}`}>
                          {report.status === "submitted"
                            ? "ส่งรายงานแล้ว"
                            : "ฉบับร่าง"}
                        </Link>
                      ) : (
                        "ยังไม่ได้จัดทำ"
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DailyRequests({
  data,
  workspace,
  user,
  workspaceName,
  canEditProject,
  id,
  projectId,
  sourceReportId,
  save,
  role,
  change,
  demoEvents,
}: {
  data: Dataset;
  workspace: string;
  user: string;
  workspaceName: string;
  canEditProject: (id: string) => boolean;
  id?: string;
  projectId?: string;
  sourceReportId?: string;
  save: (r: Report) => Promise<void>;
  role?: Workspace["role"];
  change: ChangeDocument;
  demoEvents?: DocumentEvent[];
}) {
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(projectId ?? "");
  const [date, setDate] = useState("");
  const requests = data.requests ?? [];
  const request = requests.find((r) => r.id === id);
  const activeData = activeDataset(data);
  const editableProjects = data.projects.filter((p) => canEditProject(p.id));
  const canEdit = request
    ? canEditProject(request.project_id)
    : projectId
      ? canEditProject(projectId)
      : editableProjects.length > 0;
  const documentRole =
    role === "owner"
      ? "owner"
      : request
        ? canEditProject(request.project_id)
          ? "editor"
          : "viewer"
        : undefined;
  const projects = projectId
    ? data.projects.filter((p) => p.id === projectId)
    : data.projects;
  if (id === "new" || editing) {
    if (!canEdit || (request && !isActiveDocument(request)))
      return (
        <div className="panel">
          สิทธิ์ผู้ดูข้อมูลไม่สามารถสร้างหรือแก้ไขคำขอได้
        </div>
      );
    const source = sourceReportId
      ? activeData.reports.find(
          (r) =>
            r.id === sourceReportId &&
            r.workspace_id === workspace &&
            (!projectId || r.project_id === projectId),
        )
      : undefined;
    if (source && !canEditProject(source.project_id))
      return <div className="panel">ไม่มีสิทธิ์สร้างคำขอในโครงการต้นฉบับ</div>;
    if (!editing && sourceReportId && !source)
      return (
        <div className="panel">
          ไม่พบรายงานต้นฉบับในบริษัทหรือโครงการนี้{" "}
          <Link href="/requests">กลับ Daily Request</Link>
        </div>
      );
    const existing = source
      ? requests.find(
          (r) =>
            isActiveDocument(r) &&
            r.project_id === source.project_id &&
            r.report_date === today(),
        )
      : undefined;
    return (
      <>
        {!editing && source && (
          <div className="copy-report-notice" role="status">
            <strong>
              ต้นแบบจาก Daily Report:{" "}
              {source.report_details?.meta?.report_number || source.id}
            </strong>
            <p>
              {data.projects.find((p) => p.id === source.project_id)?.name} •
              วันที่ {thaiDate(source.report_date)}
            </p>
            <p>
              คงข้อมูลโครงการและหัวเอกสารจากรายงานเดิม โปรดกรอกแผนงาน เวลาเริ่ม
              และเวลาเสร็จของวันที่ขอทำงานก่อนบันทึก ยังไม่มีการบันทึกคำขอ
            </p>
            <Link href={`/reports/${source.id}`}>
              เปิด Daily Report ต้นฉบับ
            </Link>
            {existing && (
              <p>
                มีคำขอของวันนี้แล้ว{" "}
                <Link href={`/requests/${existing.id}`}>เปิดคำขอเดิม</Link>{" "}
                หรือเลือกวันที่ขอทำงานอื่นก่อนบันทึก
              </p>
            )}
          </div>
        )}
        <ReportForm
          key={`${workspace}:${editing ? request?.id : (source?.id ?? "blank")}`}
          kind="request"
          initial={editing ? request : undefined}
          prefill={!editing && source ? requestFromReport(source) : undefined}
          projects={projects.filter((p) => canEditProject(p.id))}
          workspace={workspace}
          user={user}
          save={save}
          onCancel={editing ? () => setEditing(false) : undefined}
        />
      </>
    );
  }
  if (id) {
    const project = data.projects.find((p) => p.id === request?.project_id);
    if (!request || !project)
      return (
        <div className="panel">
          ไม่พบ Daily Request ในบริษัทนี้{" "}
          <Link href="/requests">กลับคำขอทั้งหมด</Link>
        </div>
      );
    if (request.deleted_at)
      return (
        <>
          <Link className="back-link" href="/trash">
            กลับถังขยะเอกสาร
          </Link>
          <h1>Daily Request • {project.name}</h1>
          <DocumentActions
            report={request}
            kind="request"
            role={documentRole}
            user={user}
            change={change}
          />
          <DocumentHistory
            report={request}
            kind="request"
            user={user}
            demoEvents={demoEvents}
          />
        </>
      );
    const report = activeData.reports.find(
      (r) =>
        r.project_id === request.project_id &&
        r.report_date === request.report_date,
    );
    return (
      <>
        <Link className="back-link no-print" href="/requests">
          คำขอทั้งหมด
        </Link>
        <div className="page-heading no-print">
          <div>
            <h1>Daily Request</h1>
            <p>
              {project.name} • {thaiDate(request.report_date)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && isActiveDocument(request) && (
              <button
                className="button secondary"
                onClick={() => setEditing(true)}
              >
                แก้ไขคำขอ
              </button>
            )}
            <button
              className="button primary"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                setError("");
                try {
                  await exportReportPdf(
                    `${request.report_details?.meta?.report_number || "daily-request"}_${request.report_date}`,
                    {
                      kind: "request",
                      id: request.id,
                      workspaceId: request.workspace_id,
                    },
                  );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "ส่งออก PDF ไม่สำเร็จ",
                  );
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? "กำลังส่งออก PDF…" : "ส่งออก Daily Request PDF"}
            </button>
          </div>
        </div>
        <DocumentActions
          report={request}
          kind="request"
          role={documentRole}
          user={user}
          change={change}
        />
        <DocumentHistory
          report={request}
          kind="request"
          user={user}
          demoEvents={demoEvents}
        />
        <div className="panel no-print">
          {request.report_details?.meta?.source_report_id && (
            <p>
              ต้นแบบ:{" "}
              <Link
                href={`/reports/${request.report_details.meta.source_report_id}`}
              >
                Daily Report {request.report_details.meta.source_report_number}
              </Link>{" "}
              • แผนงานและเวลาเป็นข้อมูลที่ผู้ขอระบุก่อนเริ่มงาน
            </p>
          )}
          <p>
            <b>สถานะ:</b>{" "}
            {request.status === "cancelled"
              ? "ยกเลิกแล้ว"
              : request.status === "draft"
                ? "ฉบับร่าง"
                : "ส่งคำขอแล้ว — รอผู้ควบคุมงานลงนามภายนอก"}
          </p>
          <p>
            ข้อมูลในเอกสารเป็นแผนงาน ไม่ใช่ผลการทำงานจริง
            ระบบไม่บันทึกว่าอนุมัติแล้วจากการส่งคำขอ
          </p>
          {report ? (
            <Link className="button secondary" href={`/reports/${report.id}`}>
              เปิด Daily Report ของวันเดียวกัน
            </Link>
          ) : canEdit &&
            isActiveDocument(request) &&
            request.report_date <= today() ? (
            <Link
              className="button secondary"
              href={`/reports/new?request=${request.id}`}
            >
              สร้าง Daily Report จากคำขอนี้
            </Link>
          ) : (
            <p>
              ยังไม่มี Daily Report ของวันเดียวกัน
              {request.report_date > today()
                ? " — สร้างรายงานผลจริงได้เมื่อถึงวันทำงาน"
                : ""}
            </p>
          )}
        </div>
        {error && (
          <p className="error no-print" role="alert">
            {error}
          </p>
        )}
        <RequestPrint
          report={request}
          project={project}
          workspaceName={workspaceName}
        />
      </>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Daily Request</h1>
          <p>เอกสารขออนุมัติทำงานประจำวัน • จัดทำก่อนเริ่มงาน</p>
        </div>
        {canEdit && (
          <Link className="button primary" href="/requests/new">
            สร้าง Daily Request
          </Link>
        )}
      </div>
      <DailyDocuments data={activeData} />
      {canEdit && (
        <section className="panel" style={{ marginTop: 24 }}>
          <h2>สร้างคำขอจาก Daily Report ล่าสุด</h2>
          <p>
            ใช้โครงการและหัวเอกสารเดิมเป็นต้นแบบ
            แล้วกรอกแผนงานและเวลาใหม่ก่อนบันทึก
          </p>
          {data.projects
            .filter(
              (p) =>
                canEditProject(p.id) &&
                p.status === "active" &&
                (!filter || p.id === filter),
            )
            .map((p) => {
              const latest = latestProjectReport(
                activeData.reports,
                p.id,
                workspace,
              );
              return (
                <div key={p.id} style={{ marginTop: 16 }}>
                  <strong>{p.name}</strong>
                  {latest ? (
                    <>
                      <p>
                        Daily Report ล่าสุด: {thaiDate(latest.report_date)} •{" "}
                        {latest.status === "draft"
                          ? "ฉบับร่าง"
                          : "ส่งรายงานแล้ว"}
                      </p>
                      <Link
                        className="button secondary"
                        href={`/requests/new?project=${p.id}&fromReport=${latest.id}`}
                      >
                        สร้างจาก Daily Report ล่าสุด — {p.name}
                      </Link>
                    </>
                  ) : (
                    <p>
                      ยังไม่มี Daily Report สำหรับใช้เป็นต้นแบบ{" "}
                      <Link href={`/requests/new?project=${p.id}`}>
                        สร้างคำขอเปล่า
                      </Link>
                    </p>
                  )}
                </div>
              );
            })}
        </section>
      )}
      <div className="panel" style={{ marginTop: 24 }}>
        <div className="form-grid">
          <label>
            โครงการคำขอ
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">ทุกโครงการ</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            วันที่ขอทำงาน
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>โครงการ</th>
                <th>วันที่ขอทำงาน</th>
                <th>สถานะคำขอ</th>
                <th>Daily Report</th>
              </tr>
            </thead>
            <tbody>
              {requests
                .filter(
                  (r) =>
                    !r.deleted_at &&
                    (!filter || r.project_id === filter) &&
                    (!date || r.report_date === date),
                )
                .sort((a, b) => b.report_date.localeCompare(a.report_date))
                .map((r) => {
                  const report = activeData.reports.find(
                    (x) =>
                      x.project_id === r.project_id &&
                      x.report_date === r.report_date,
                  );
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/requests/${r.id}`}>
                          {
                            data.projects.find((p) => p.id === r.project_id)
                              ?.name
                          }
                        </Link>
                      </td>
                      <td>
                        <Link href={`/requests/${r.id}`}>
                          {thaiDate(r.report_date)}
                        </Link>
                      </td>
                      <td>{documentStatus(r, "request")}</td>
                      <td>
                        {report ? (
                          <Link href={`/reports/${report.id}`}>เปิดรายงาน</Link>
                        ) : (
                          "ยังไม่ได้จัดทำ"
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!requests.some((r) => !r.deleted_at) && (
          <p>ยังไม่มี Daily Request เริ่มสร้างคำขอก่อนเริ่มงานของโครงการ</p>
        )}
      </div>
    </>
  );
}
