"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2, RotateCcw, Ban } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  canTrashDocument,
  documentStatus,
  restoreDeadline,
  type ChangeDocument,
  type DocumentAction,
  type DocumentKind,
} from "@/lib/document-lifecycle";
import {
  type Dataset,
  type DocumentEvent,
  type Report,
  type Workspace,
  thaiDate,
} from "@/lib/types";

export function DocumentActions({
  report,
  kind,
  role,
  user,
  change,
}: {
  report: Report;
  kind: DocumentKind;
  role?: Workspace["role"];
  user: string;
  change: ChangeDocument;
}) {
  const [action, setAction] = useState<DocumentAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const deadline = restoreDeadline(report);
  const expired = !!deadline && now >= deadline.getTime();
  async function submit() {
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      await change(kind, report, action, reason.trim());
      setAction(null);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel no-print document-actions">
      <p>
        <b>สถานะ: {documentStatus(report, kind)}</b>
      </p>
      {report.deleted_at && (
        <p>
          กู้คืนได้ถึง{" "}
          {deadline!.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
          {expired ? " — ครบกำหนด 30 วันแล้ว" : ""} • เก็บรูปแนบไว้กับร่าง
        </p>
      )}
      {report.status === "cancelled" && (
        <>
          <p>เหตุผลที่ยกเลิก: {report.cancellation_reason}</p>
          <p>
            ยกเลิกเมื่อ{" "}
            {report.cancelled_at
              ? new Date(report.cancelled_at).toLocaleString("th-TH", {
                  timeZone: "Asia/Bangkok",
                })
              : "—"}{" "}
            • เก็บเอกสารและรูปแนบไว้ตรวจย้อนหลัง
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {canTrashDocument(report, role, user) && (
          <button
            className="button secondary danger"
            onClick={() => setAction("trash")}
          >
            <Trash2 size={16} />
            ย้ายร่างไปถังขยะ
          </button>
        )}
        {report.deleted_at && role === "owner" && (
          <button
            disabled={expired}
            className="button secondary"
            onClick={() => setAction("restore")}
          >
            <RotateCcw size={16} />
            กู้คืนร่าง
          </button>
        )}
        {!report.deleted_at &&
          report.status === "submitted" &&
          role === "owner" && (
            <button
              className="button secondary danger"
              onClick={() => setAction("cancel")}
            >
              <Ban size={16} />
              ยกเลิกเอกสาร
            </button>
          )}
        {report.deleted_at && role !== "owner" && (
          <p>ให้ Owner ของบริษัทกู้คืนร่างภายใน 30 วัน</p>
        )}
      </div>
      {action && (
        <form
          className="document-confirm"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          aria-label="ยืนยันจัดการเอกสาร"
        >
          <h3>
            {action === "trash"
              ? "ย้ายร่างนี้ไปถังขยะ?"
              : action === "restore"
                ? "กู้คืนเป็นฉบับร่าง?"
                : "ยกเลิกเอกสารที่ส่งแล้ว?"}
          </h3>
          <p>
            {action === "trash"
              ? "ร่างจะหายจากรายการใช้งาน Owner กู้คืนได้ภายใน 30 วัน โดยรูปแนบยังอยู่ครบ"
              : action === "restore"
                ? "หากมีเอกสารใช้งานของโครงการและวันเดียวกันอยู่แล้ว จะกู้คืนไม่ได้จนกว่าจะจัดการฉบับนั้น"
                : "เก็บข้อมูลเดิม รูปแนบ และประวัติไว้ เอกสารนี้จะเปิดอ่านได้แต่แก้ไขต่อไม่ได้"}
          </p>
          {action === "cancel" && (
            <label>
              เหตุผลที่ยกเลิก
              <textarea
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className="button primary"
              disabled={busy || (action === "cancel" && !reason.trim())}
            >
              {busy
                ? "กำลังบันทึก…"
                : action === "trash"
                  ? "ยืนยันย้ายไปถังขยะ"
                  : action === "restore"
                    ? "ยืนยันกู้คืนร่าง"
                    : "ยืนยันยกเลิกเอกสาร"}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setAction(null);
                setError("");
              }}
            >
              ปิด
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

const eventLabels = {
  created: "สร้างเอกสาร",
  edited: "แก้ไขเอกสาร",
  submitted: "ส่งเอกสาร",
  trashed: "ย้ายไปถังขยะ",
  restored: "กู้คืนร่าง",
  cancelled: "ยกเลิกเอกสาร",
};
export function DocumentHistory({
  report,
  kind,
  user,
  demoEvents,
}: {
  report: Report;
  kind: DocumentKind;
  user: string;
  demoEvents?: DocumentEvent[];
}) {
  const [events, setEvents] = useState<DocumentEvent[]>([]);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(25);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    if (demoEvents || !open) return;
    supabase
      ?.from("document_events")
      .select("*")
      .eq("workspace_id", report.workspace_id)
      .eq("document_kind", kind)
      .eq("document_id", report.id)
      .order("occurred_at", { ascending: false })
      .order("id")
      .limit(limit)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setError("โหลดประวัติไม่สำเร็จ กรุณาเปิดเอกสารใหม่");
          return;
        }
        setEvents(data as DocumentEvent[]);
        setError("");
      });
    return () => {
      alive = false;
    };
  }, [
    report.id,
    report.workspace_id,
    report.updated_at,
    kind,
    limit,
    demoEvents,
    open,
  ]);
  const history = demoEvents
    ? demoEvents
        .filter((e) => e.document_kind === kind && e.document_id === report.id)
        .toReversed()
    : events;
  return (
    <details
      className="panel no-print document-history"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>ประวัติเอกสาร</summary>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!history.length && !error && (
        <p>ยังไม่มีประวัติหลังเปิดใช้ระบบบันทึกประวัติ</p>
      )}
      <ol>
        {history.map((event) => (
          <li key={event.id}>
            <strong>{eventLabels[event.action]}</strong> •{" "}
            {new Date(event.occurred_at).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
            })}
            <p>
              ผู้ดำเนินการ:{" "}
              {event.actor_id === user ? "คุณ" : event.actor_id || "ระบบ"}
            </p>
            {event.reason && <p>เหตุผล: {event.reason}</p>}
            {event.before_data && (
              <details>
                <summary>ข้อมูลเอกสารก่อนดำเนินการ</summary>
                <p>
                  {event.before_data.report_details?.meta?.report_number ||
                    (kind === "report" ? "Daily Report" : "Daily Request")}{" "}
                  • {thaiDate(event.before_data.report_date)}
                </p>
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {event.before_data.work_done}
                </p>
                <p>รูปแนบในประวัติ {event.photos?.length ?? 0} รูป</p>
              </details>
            )}
          </li>
        ))}
      </ol>
      {!demoEvents && history.length >= limit && (
        <button
          className="button secondary"
          onClick={() => setLimit(limit + 25)}
        >
          ดูประวัติเพิ่มเติม
        </button>
      )}
    </details>
  );
}

export function DocumentTrash({
  data,
  role,
  user,
  change,
}: {
  data: Dataset;
  role?: Workspace["role"];
  user: string;
  change: ChangeDocument;
}) {
  const documents = [
    ...data.reports.map((r) => ({ kind: "report" as const, report: r })),
    ...(data.requests ?? []).map((r) => ({
      kind: "request" as const,
      report: r,
    })),
  ]
    .filter(({ report }) => report.deleted_at)
    .sort((a, b) => b.report.deleted_at!.localeCompare(a.report.deleted_at!));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>ถังขยะเอกสาร</h1>
          <p>Owner กู้คืนร่างได้ภายใน 30 วัน • Editor เห็นเฉพาะร่างของตนเอง</p>
        </div>
      </div>
      {!documents.length && <div className="panel">ไม่มีร่างในถังขยะ</div>}
      {documents.map(({ kind, report }) => (
        <article key={`${kind}:${report.id}`} className="trash-document">
          <h2>
            <Link
              href={`/${kind === "report" ? "reports" : "requests"}/${report.id}`}
            >
              {kind === "report" ? "Daily Report" : "Daily Request"} •{" "}
              {data.projects.find((p) => p.id === report.project_id)?.name} •{" "}
              {thaiDate(report.report_date)}
            </Link>
          </h2>
          <DocumentActions
            report={report}
            kind={kind}
            role={role}
            user={user}
            change={change}
          />
        </article>
      ))}
    </>
  );
}
