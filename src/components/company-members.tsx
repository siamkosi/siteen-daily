"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import type { ProjectAssignment, ProjectRole } from "@/lib/project-access";
import {
  cursorArgs,
  invitationError,
  type AccessEvent,
  type Cursor,
  type PageResult,
} from "@/lib/invitations";
import { CompanyInvitations } from "./company-invitations";
const actions: Record<string, string> = {
  legacy_membership_migrated: "ปรับสมาชิกเป็นสิทธิ์รายโครงการ",
  project_assignment_changed: "เปลี่ยนสิทธิ์โครงการ",
  invitation_send_requested: "ขอส่งคำเชิญ",
  invitation_delivery_recorded: "บันทึกผลส่งอีเมล",
  invitation_accepted: "ยอมรับคำเชิญ",
  invitation_cancelled: "ยกเลิกคำเชิญ",
};
type Member = { user_id: string; email: string; role: "owner" | "member" };
export function CompanyMembers({
  workspace,
  workspaceName,
  projects,
  onChanged,
}: {
  workspace: string;
  workspaceName: string;
  projects: Project[];
  onChanged: () => Promise<void>;
}) {
  const [members, setMembers] = useState<Member[]>([]),
    [assignments, setAssignments] = useState<ProjectAssignment[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [change, setChange] = useState<{
    member: Member;
    project: Project;
    role: ProjectRole | null;
    version: number;
  } | null>(null);
  const [events, setEvents] = useState<AccessEvent[]>([]),
    [cursor, setCursor] = useState<Cursor>(null),
    [auditError, setAuditError] = useState("");
  const alive = useRef(false),
    generation = useRef(0);
  const audit = useCallback(
    async (after: Cursor = null) => {
      if (!supabase) return;
      const r = await supabase.rpc("list_company_access_events", {
        target_workspace: workspace,
        ...cursorArgs(after),
      });
      if (r.error) throw r.error;
      const p = r.data as PageResult<AccessEvent>;
      if (alive.current) {
        setEvents((old) =>
          after ? [...old, ...(p.items ?? [])] : (p.items ?? []),
        );
        setCursor(p.next_cursor ?? null);
      }
    },
    [workspace],
  );
  const load = useCallback(async () => {
    if (!supabase) return;
    const gen = ++generation.current;
    const [m, a] = await Promise.all([
      supabase.rpc("list_company_members", { target_workspace: workspace }),
      supabase.rpc("list_project_assignments", { target_workspace: workspace }),
    ]);
    if (m.error) throw m.error;
    if (a.error) throw a.error;
    if (alive.current && gen === generation.current) {
      setMembers(m.data ?? []);
      setAssignments(a.data ?? []);
    }
  }, [workspace]);
  useEffect(() => {
    alive.current = true;
    void load()
      .catch((e) => {
        if (alive.current) setError(invitationError(e));
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    void audit().catch(() => {
      if (alive.current) setAuditError("โหลดประวัติไม่สำเร็จ");
    });
    return () => {
      alive.current = false;
      // Request generation counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
  }, [load, audit]);
  return (
    <>
      <section
        className="panel settings"
        aria-labelledby="company-members-title"
      >
        <h2 id="company-members-title">จัดการสมาชิก — {workspaceName}</h2>
        <p>
          Owner ดูแลทุกโครงการและจัดการสมาชิก
          ส่วนสมาชิกเห็นเฉพาะโครงการที่มอบหมาย
        </p>
        <ul>
          <li>
            editor: ดู สร้างและแก้ไข Daily Request / Daily Report
            และรูปในโครงการ
          </li>
          <li>viewer: ดูข้อมูลและส่งออก PDF ในโครงการ</li>
          <li>ไม่มอบหมาย: ไม่เห็นโครงการ เอกสาร รูป หรือ PDF</li>
        </ul>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {loading ? (
          <p role="status">กำลังโหลดสมาชิก…</p>
        ) : (
          <div className="member-grid">
            {members.map((m) => (
              <article className="invitation-item" key={m.user_id}>
                <h3>{m.email}</h3>
                <p>
                  {m.role === "owner"
                    ? "owner — เข้าถึงทุกโครงการ เปลี่ยนไม่ได้ในหน้านี้"
                    : "member — สิทธิ์ตามโครงการ"}
                </p>
                {m.role !== "owner" &&
                  projects.map((p) => {
                    const a = assignments.find(
                      (a) => a.user_id === m.user_id && a.project_id === p.id,
                    );
                    return (
                      <label key={p.id}>
                        {p.name}
                        <select
                          aria-label={`สิทธิ์ ${m.email} — ${p.name}`}
                          disabled={busy || !!change || !!error}
                          value={a?.role ?? ""}
                          onChange={(e) =>
                            setChange({
                              member: m,
                              project: p,
                              role: (e.target.value ||
                                null) as ProjectRole | null,
                              version: a?.row_version ?? 0,
                            })
                          }
                        >
                          <option value="">ไม่มอบหมาย</option>
                          <option value="editor">editor — ดูและแก้ไข</option>
                          <option value="viewer">
                            viewer — ดูและส่งออก PDF
                          </option>
                        </select>
                      </label>
                    );
                  })}
              </article>
            ))}
          </div>
        )}
        {change && (
          <div
            className="invitation-item"
            role="region"
            aria-label="ยืนยันเปลี่ยนสิทธิ์"
          >
            <h3>ยืนยันเปลี่ยนสิทธิ์</h3>
            <p>
              {change.member.email} • {change.project.name} →{" "}
              {change.role ?? "ไม่มอบหมาย"}
            </p>
            <p>
              {change.role
                ? "ใช้สิทธิ์นี้เฉพาะโครงการที่เลือก"
                : "สมาชิกจะเข้าถึงโครงการ เอกสาร รูป และ PDF นี้ไม่ได้"}
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setChange(null)}
            >
              กลับ
            </button>{" "}
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (!supabase) return;
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  const r = await supabase.rpc("set_project_assignment", {
                    target_workspace: workspace,
                    target_project: change.project.id,
                    target_user: change.member.user_id,
                    new_role: change.role,
                    expected_version: change.version,
                  });
                  if (r.error) throw r.error;
                  setMessage("บันทึกสิทธิ์โครงการแล้ว");
                  setChange(null);
                  setMembers([]);
                  await load();
                  await onChanged();
                  await audit();
                } catch (e) {
                  if (alive.current) {
                    setError(invitationError(e));
                    setChange(null);
                    setMembers([]);
                  }
                } finally {
                  if (alive.current) setBusy(false);
                }
              }}
            >
              ยืนยันเปลี่ยนสิทธิ์
            </button>
          </div>
        )}
        <button
          className="text-button"
          disabled={busy || loading || !!change}
          onClick={async () => {
            setLoading(true);
            setError("");
            setMembers([]);
            try {
              await load();
            } catch (e) {
              setError(invitationError(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          โหลดรายชื่อใหม่
        </button>
        <p className="muted">
          การถอนสิทธิ์บล็อกคำขอใหม่ทันที
          รูปที่เคยเปิดผ่านลิงก์ชั่วคราวอาจยังใช้ได้จนหมดอายุไม่เกินหนึ่งชั่วโมง
        </p>
      </section>
      <CompanyInvitations workspace={workspace} projects={projects} />
      <section className="panel settings">
        <h2>ประวัติการจัดการสิทธิ์</h2>
        {auditError && <p role="alert">{auditError}</p>}
        {!events.length && <p>ยังไม่มีประวัติ</p>}
        {events.map((e) => (
          <article key={e.id} className="invitation-item">
            <b>{actions[e.action] ?? "เปลี่ยนแปลงสิทธิ์"}</b>
            <p>
              {new Date(e.created_at).toLocaleString("th-TH")} •{" "}
              {members.find((m) => m.user_id === e.actor_id)?.email ??
                e.actor_id ??
                "ระบบ"}
            </p>
            <p>
              {typeof e.details.email === "string"
                ? e.details.email
                : (members.find((m) => m.user_id === e.details.user_id)
                    ?.email ?? "")}
            </p>
            {typeof e.details.project_id === "string" && (
              <p>
                โครงการ:{" "}
                {projects.find((p) => p.id === e.details.project_id)?.name ??
                  "โครงการเดิม"}
              </p>
            )}
            {Array.isArray(e.details.project_ids) && (
              <p>
                โครงการ:{" "}
                {e.details.project_ids
                  .map(
                    (id) =>
                      projects.find((p) => p.id === id)?.name ?? "โครงการเดิม",
                  )
                  .join(", ")}
              </p>
            )}
            {"role" in e.details && (
              <p>
                สิทธิ์:{" "}
                {typeof e.details.role === "string"
                  ? e.details.role
                  : "ไม่มอบหมาย"}
              </p>
            )}
            {typeof e.details.result === "string" && (
              <p>ผลส่งอีเมล: {e.details.result}</p>
            )}
          </article>
        ))}
        <button
          className="text-button"
          onClick={() => {
            setAuditError("");
            void audit().catch(() => setAuditError("โหลดประวัติไม่สำเร็จ"));
          }}
        >
          โหลดประวัติใหม่
        </button>
        {cursor && (
          <button
            className="text-button"
            onClick={() =>
              void audit(cursor).catch(() =>
                setAuditError("โหลดประวัติไม่สำเร็จ"),
              )
            }
          >
            ประวัติเพิ่มเติม
          </button>
        )}
      </section>
    </>
  );
}
