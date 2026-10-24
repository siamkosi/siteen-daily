"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  cursorArgs,
  invitationError,
  type Cursor,
  type Invitation,
  type PageResult,
} from "@/lib/invitations";
import type { Project } from "@/lib/types";
type Preview = {
  email: string;
  role: "editor" | "viewer";
  projectIds: string[];
  requestId: string;
  invitationId?: string;
  expectedVersion?: number;
};
export function CompanyInvitations({
  workspace,
  projects,
}: {
  workspace: string;
  projects: Project[];
}) {
  const [items, setItems] = useState<Invitation[]>([]),
    [cursor, setCursor] = useState<Cursor>(null),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<"editor" | "viewer">("editor"),
    [selected, setSelected] = useState<string[]>([]),
    [preview, setPreview] = useState<Preview | null>(null),
    [cancel, setCancel] = useState<Invitation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const alive = useRef(false);
  const load = useCallback(
    async (after: Cursor = null) => {
      if (!supabase) return;
      const r = await supabase.rpc("list_company_invitations", {
        target_workspace: workspace,
        ...cursorArgs(after),
      });
      if (r.error) throw r.error;
      const p = r.data as PageResult<Invitation>;
      if (alive.current) {
        setItems((old) =>
          after ? [...old, ...(p.items ?? [])] : (p.items ?? []),
        );
        setCursor(p.next_cursor ?? null);
      }
    },
    [workspace],
  );
  useEffect(() => {
    alive.current = true;
    void load().catch((e) => {
      if (alive.current) setError(invitationError(e));
    });
    return () => {
      alive.current = false;
    };
  }, [load]);
  async function send() {
    if (!preview || !supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw Error();
      const r = await fetch("/api/company-invitations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ workspaceId: workspace, ...preview }),
      });
      const result = await r.json();
      if (!alive.current) return;
      if (result.delivery_status === "sent")
        setMessage("ส่งอีเมลแล้ว กรุณาให้ผู้รับยืนยันและยอมรับคำเชิญ");
      else if (
        result.delivery_status === "unknown" ||
        result.delivery_status === "sending"
      )
        setMessage(
          "ยังยืนยันผลส่งอีเมลไม่ได้ กรุณาตรวจสถานะและกล่องจดหมายก่อนส่งซ้ำ",
        );
      else if (result.delivery_status === "failed")
        setMessage(
          "ส่งอีเมลไม่สำเร็จ คำเชิญยังอยู่และยังไม่ให้สิทธิ์ กรุณาตรวจการตั้งค่าอีเมล",
        );
      else throw Error(result.error ?? "ส่งคำเชิญไม่สำเร็จ");
      setPreview(null);
      await load();
    } catch (e) {
      if (alive.current) {
        setError(
          e instanceof Error ? e.message : "ตรวจสถานะก่อนลองใหม่",
        ); /* Retain request ID: transport retries must be idempotent. */
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="panel settings invitation-panel">
      <h2>เชิญสมาชิกทางอีเมล</h2>
      <p>
        คำเชิญอายุ 7 วัน
        ผู้รับจะเห็นเฉพาะโครงการที่เลือกหลังยืนยันอีเมลและกดยอมรับ
        สมาชิกเดิมให้จัดการสิทธิ์ด้านบน
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <form
        className="invitation-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setMessage("");
          if (!selected.length) {
            setError("เลือกอย่างน้อยหนึ่งโครงการ");
            return;
          }
          setPreview({
            email: email.trim().toLowerCase(),
            role,
            projectIds: [...selected],
            requestId: crypto.randomUUID(),
          });
        }}
      >
        <fieldset disabled={busy || !!preview || !!cancel}>
          <legend>ข้อมูลคำเชิญ</legend>
          <label>
            อีเมลผู้รับคำเชิญ
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            บทบาทในโครงการ
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
            >
              <option value="editor">editor — บันทึกและแก้ไข</option>
              <option value="viewer">viewer — ดูและส่งออก PDF</option>
            </select>
          </label>
          <p>โครงการที่อนุญาต</p>
          {projects.map((p) => (
            <label className="checkbox-label" key={p.id}>
              <input
                type="checkbox"
                aria-label={`เชิญเข้าโครงการ ${p.name}`}
                checked={selected.includes(p.id)}
                onChange={(e) =>
                  setSelected((old) =>
                    e.target.checked
                      ? [...old, p.id]
                      : old.filter((id) => id !== p.id),
                  )
                }
              />
              {p.name}
            </label>
          ))}
          <button className="button primary" disabled={!projects.length}>
            ตรวจคำเชิญ
          </button>
        </fieldset>
      </form>
      {preview && (
        <div
          className="invitation-item"
          role="region"
          aria-label="ตรวจคำเชิญก่อนส่ง"
        >
          <h3>ตรวจคำเชิญก่อนส่ง</h3>
          <p>
            {preview.email} • {preview.role}
          </p>
          <p>
            โครงการ:{" "}
            {preview.projectIds
              .map((id) => projects.find((p) => p.id === id)?.name ?? id)
              .join(", ")}
          </p>
          <p>ส่งลิงก์เข้าสู่ระบบให้ผู้รับ สิทธิ์จะเริ่มหลังผู้รับกดยอมรับ</p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setPreview(null)}
          >
            กลับไปแก้ไข
          </button>{" "}
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void send()}
          >
            ยืนยันส่งคำเชิญ
          </button>
        </div>
      )}
      <h3>สถานะคำเชิญ</h3>
      {items.map((i) => (
        <article className="invitation-item" key={i.id}>
          <b>{i.email}</b>
          <p>
            {i.projects.map((p) => p.name).join(", ")} • {i.role}
          </p>
          <p>
            <span>{i.status}</span> • อีเมล: {i.delivery_status}
          </p>
          <p>หมดอายุ {new Date(i.expires_at).toLocaleString("th-TH")}</p>
          {i.status === "pending" && (
            <>
              <button
                className="button secondary"
                disabled={busy || !!preview || !!cancel}
                onClick={() => {
                  setMessage("");
                  setPreview({
                    email: i.email,
                    role: i.role,
                    projectIds: i.projects.map((p) => p.id),
                    requestId: crypto.randomUUID(),
                    invitationId: i.id,
                    expectedVersion: i.row_version,
                  });
                }}
              >
                ส่งคำเชิญซ้ำ
              </button>{" "}
              <button
                className="text-button"
                disabled={busy || !!preview || !!cancel}
                onClick={() => setCancel(i)}
              >
                ยกเลิกคำเชิญ
              </button>
            </>
          )}
        </article>
      ))}
      {cancel && (
        <div role="region" aria-label="ยืนยันยกเลิกคำเชิญ">
          <p>ยกเลิกคำเชิญ {cancel.email} ผู้รับจะยอมรับไม่ได้</p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setCancel(null)}
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
              try {
                const r = await supabase.rpc("cancel_company_invitation", {
                  target_workspace: workspace,
                  target_invitation: cancel.id,
                  expected_version: cancel.row_version,
                });
                if (r.error) throw r.error;
                setCancel(null);
                await load();
              } catch (e) {
                setError(invitationError(e));
                setCancel(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            ยืนยันยกเลิกคำเชิญ
          </button>
        </div>
      )}
      <button
        className="text-button"
        disabled={busy || !!preview || !!cancel}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await load();
          } catch (e) {
            setError(invitationError(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        โหลดสถานะคำเชิญใหม่
      </button>
      {cursor && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            void load(cursor).catch((e) => setError(invitationError(e)))
          }
        >
          คำเชิญเพิ่มเติม
        </button>
      )}
    </section>
  );
}
