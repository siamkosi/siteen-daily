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
export function PendingInvitations({
  onAccepted,
}: {
  onAccepted: (workspace: string) => Promise<void>;
}) {
  const [items, setItems] = useState<Invitation[]>([]),
    [cursor, setCursor] = useState<Cursor>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(false);
  const load = useCallback(async (after: Cursor = null) => {
    if (!supabase) return;
    const r = await supabase.rpc(
      "list_my_company_invitations",
      cursorArgs(after),
    );
    if (r.error) throw r.error;
    const p = r.data as PageResult<Invitation>;
    if (alive.current) {
      setItems((old) =>
        after ? [...old, ...(p.items ?? [])] : (p.items ?? []),
      );
      setCursor(p.next_cursor ?? null);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void load().catch((e) => {
      if (alive.current) setError(invitationError(e));
    });
    return () => {
      alive.current = false;
    };
  }, [load]);
  if (!items.length && !error) return null;
  return (
    <section
      className="panel settings invitation-panel"
      aria-label="คำเชิญของฉัน"
    >
      <h2>คำเชิญเข้าบริษัท</h2>
      <p>
        ยืนยันอีเมลและกดยอมรับก่อนเข้าถึงโครงการ
        ไม่ต้องสร้างบริษัทใหม่เพื่อเข้าร่วมทีม
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!items.length && !error && <p>ไม่มีคำเชิญที่รอยอมรับ</p>}
      {items.map((i) => (
        <article key={i.id} className="invitation-item">
          <h3>{i.company_name}</h3>
          <p>
            {i.email} • {i.role}
          </p>
          <p>โครงการ: {i.projects.map((p) => p.name).join(", ")}</p>
          <p>หมดอายุ {new Date(i.expires_at).toLocaleString("th-TH")}</p>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              if (!supabase) return;
              setBusy(true);
              setError("");
              try {
                const r = await supabase.rpc("accept_company_invitation", {
                  target_invitation: i.id,
                  expected_version: i.row_version,
                });
                if (r.error) throw r.error;
                await onAccepted(r.data as string);
                await load();
              } catch (e) {
                if (alive.current) setError(invitationError(e));
              } finally {
                if (alive.current) setBusy(false);
              }
            }}
          >
            ยอมรับคำเชิญ
          </button>
        </article>
      ))}
      <button
        className="text-button"
        disabled={busy}
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
        ตรวจคำเชิญใหม่
      </button>
      {cursor && (
        <button
          className="text-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await load(cursor);
            } catch (e) {
              setError(invitationError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          คำเชิญเพิ่มเติม
        </button>
      )}
    </section>
  );
}
