"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Member = {
  user_id: string;
  email: string;
  role: "owner" | "editor" | "viewer";
};
const labels = {
  owner: "เจ้าของบริษัท",
  editor: "ผู้บันทึก / วิศวกร",
  viewer: "ผู้ดูข้อมูล",
};

export function CompanyMembers({
  workspace,
  workspaceName,
}: {
  workspace: string;
  workspaceName: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [change, setChange] = useState<{
    member: Member;
    role: "editor" | "viewer";
  } | null>(null);
  const alive = useRef(false);
  const load = useCallback(async () => {
    if (!supabase) throw new Error("ยังไม่ได้เชื่อมต่อ DEV");
    const result = await supabase.rpc("list_company_members", {
      target_workspace: workspace,
    });
    if (result.error) throw result.error;
    if (alive.current) setMembers(result.data ?? []);
  }, [workspace]);
  useEffect(() => {
    alive.current = true;
    load()
      .catch(() => {
        if (alive.current)
          setError("โหลดรายชื่อไม่ได้ กรุณาตรวจสิทธิ์ owner แล้วลองใหม่");
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, [load]);
  return (
    <section className="panel settings" aria-labelledby="company-members-title">
      <h2 id="company-members-title">จัดการสมาชิก — {workspaceName}</h2>
      <p>
        owner เปลี่ยนบทบาทสมาชิกระหว่าง editor และ viewer ได้
        สิทธิ์ใช้กับทุกโครงการและรายงานในบริษัทนี้
      </p>
      <ul>
        <li>owner: ดูและแก้ไขข้อมูล พร้อมจัดการบทบาทสมาชิก</li>
        <li>editor: ดู สร้างและแก้ไขโครงการ/รายงาน เพิ่มและลบรูป</li>
        <li>viewer: ดูข้อมูลและส่งออก PDF</li>
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
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>อีเมล</th>
                <th>บทบาท</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.user_id}>
                  <td>{member.email}</td>
                  <td>
                    {member.role} — {labels[member.role]}
                  </td>
                  <td>
                    {member.role === "owner" ? (
                      "owner — เปลี่ยนไม่ได้ในหน้านี้"
                    ) : (
                      <button
                        className="button secondary"
                        disabled={busy || Boolean(change)}
                        onClick={() => {
                          setError("");
                          setMessage("");
                          setChange({
                            member,
                            role:
                              member.role === "editor" ? "viewer" : "editor",
                          });
                        }}
                      >
                        เปลี่ยน {member.email} เป็น{" "}
                        {member.role === "editor" ? "viewer" : "editor"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && members.length === 0 && <p>ไม่พบสมาชิก</p>}
      {change && (
        <div className="panel" role="region" aria-label="ยืนยันเปลี่ยนบทบาท">
          <h3>ยืนยันเปลี่ยนบทบาท</h3>
          <p>
            {change.member.email}: {change.member.role} → {change.role} ในบริษัท{" "}
            {workspaceName}
          </p>
          <p>
            {change.role === "viewer"
              ? "สมาชิกจะดูและส่งออก PDF ได้ แต่จะบันทึกแก้ไขโครงการ รายงาน หรือรูปไม่ได้"
              : "สมาชิกจะสร้างและแก้ไขโครงการ รายงาน และจัดการรูปภาพของบริษัทได้"}
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setChange(null)}
          >
            ยกเลิกการเปลี่ยนบทบาท
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
                const result = await supabase.rpc("set_company_member_role", {
                  target_workspace: workspace,
                  target_user: change.member.user_id,
                  new_role: change.role,
                  expected_role: change.member.role,
                });
                if (result.error) throw result.error;
                if (!alive.current) return;
                setMessage(
                  `บันทึกแล้ว: ${change.member.email} เป็น ${change.role}`,
                );
                setChange(null);
                // Do not leave stale role controls enabled if the reload fails.
                setMembers([]);
                await load();
              } catch {
                if (alive.current) {
                  setError(
                    "ดำเนินการไม่สำเร็จหรือรายชื่อเปลี่ยนแล้ว กรุณาโหลดรายชื่อใหม่ก่อนลองอีกครั้ง",
                  );
                  setChange(null);
                  setMembers([]);
                }
              } finally {
                if (alive.current) setBusy(false);
              }
            }}
          >
            {busy ? "กำลังบันทึก…" : "ยืนยันเปลี่ยนบทบาท"}
          </button>
        </div>
      )}
      <button
        className="text-button"
        disabled={busy || loading || Boolean(change)}
        onClick={async () => {
          setError("");
          setMessage("");
          setLoading(true);
          setMembers([]);
          try {
            await load();
          } catch {
            if (alive.current)
              setError("โหลดรายชื่อไม่ได้ กรุณาตรวจสิทธิ์ owner");
          } finally {
            if (alive.current) setLoading(false);
          }
        }}
      >
        โหลดรายชื่อใหม่
      </button>
      <p className="muted">
        หน้านี้ไม่มีการเพิ่มบัญชี ลบสมาชิก หรือเปลี่ยน owner
        สมาชิกที่เปิดแอปค้างไว้ควรโหลดหน้าใหม่หลังเปลี่ยนบทบาท
      </p>
    </section>
  );
}
