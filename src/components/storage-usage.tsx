"use client";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  formatStorage,
  storageLevel,
  STORAGE_GB,
  type StorageSummary,
} from "@/lib/storage-usage";
import type { Workspace } from "@/lib/types";
export function StorageWarning({
  summary,
  error,
  link = true,
}: {
  summary: StorageSummary | null;
  error?: string;
  link?: boolean;
}) {
  if (error)
    return (
      <div className="storage-notice no-print" role="status">
        {error} {link && <Link href="/storage">ตรวจพื้นที่จัดเก็บ</Link>}
      </div>
    );
  if (!summary) return null;
  const level = storageLevel(summary);
  if (
    !["warning", "critical", "full"].includes(level) &&
    !summary.totals.unknown_files
  )
    return null;
  const percent = summary.quota_bytes
    ? (summary.totals.total_bytes / summary.quota_bytes) * 100
    : null;
  return (
    <div className={`storage-notice no-print storage-${level}`} role="alert">
      {["warning", "critical", "full"].includes(level) && (
        <strong>
          {level === "full"
            ? "พื้นที่รูปถึงโควตาบริษัทแล้ว"
            : level === "critical"
              ? "พื้นที่รูปใกล้เต็มมาก"
              : "พื้นที่รูปใกล้เต็ม"}{" "}
          • ใช้แล้ว {percent!.toFixed(1)}%
        </strong>
      )}
      {summary.totals.unknown_files > 0 && (
        <p>
          มี {summary.totals.unknown_files} ไฟล์ที่ยังระบุขนาดไม่ได้
          ยอดพื้นที่อาจสูงกว่าที่แสดง
        </p>
      )}
      {link && <Link href="/storage">ดูพื้นที่แยกตามโครงการ</Link>}
    </div>
  );
}
export function StorageUsagePage({
  workspace,
  role,
  summary,
  loading,
  error,
  refresh,
  demo,
  saveDemoQuota,
}: {
  workspace: string;
  role?: Workspace["role"];
  summary: StorageSummary | null;
  loading: boolean;
  error: string;
  refresh: () => void;
  demo: boolean;
  saveDemoQuota: (quota: number | null) => void;
}) {
  const [draft, setDraft] = useState<{
    value: string;
    expected: number | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const quotaValue =
    draft?.value ??
    (summary?.quota_bytes === null || !summary
      ? ""
      : String(summary.quota_bytes / STORAGE_GB));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>พื้นที่จัดเก็บรูป</h1>
          <p>สรุปพื้นที่ของบริษัท แยกตามโครงการ</p>
        </div>
        <button
          className="button secondary"
          disabled={loading || busy}
          onClick={refresh}
        >
          {loading ? "กำลังตรวจสอบ…" : "อัปเดตพื้นที่ล่าสุด"}
        </button>
      </div>
      {error && (
        <div className="panel">
          <p className="error" role="alert">
            {error}
          </p>
          <button className="button secondary" onClick={refresh}>
            ลองตรวจพื้นที่ใหม่
          </button>
        </div>
      )}
      {loading && !summary && <p role="status">กำลังสรุปพื้นที่จัดเก็บรูป…</p>}
      {summary && (
        <>
          <StorageWarning summary={summary} link={false} />
          <div className="storage-summary-cards">
            <article>
              <small>
                พื้นที่ใช้แล้ว
                {summary.totals.unknown_files ? " (อย่างน้อย)" : ""}
              </small>
              <strong>{formatStorage(summary.totals.total_bytes)}</strong>
              <span>{summary.totals.total_files} ไฟล์ รวมภาพตัวอย่าง</span>
            </article>
            <article>
              <small>โควตาแจ้งเตือนของบริษัท</small>
              <strong>
                {summary.quota_bytes === null
                  ? "ยังไม่กำหนด"
                  : formatStorage(summary.quota_bytes)}
              </strong>
              <span>เตือนที่ 80% / 95% / 100%</span>
            </article>
            <article>
              <small>พื้นที่เหลือในโควตา</small>
              <strong>
                {summary.quota_bytes === null
                  ? "—"
                  : formatStorage(
                      Math.max(
                        0,
                        summary.quota_bytes - summary.totals.total_bytes,
                      ),
                    )}
              </strong>
              <span>
                {summary.quota_bytes === null
                  ? "Owner กำหนดโควตาได้ด้านล่าง"
                  : `ใช้แล้ว ${((summary.totals.total_bytes / summary.quota_bytes) * 100).toFixed(1)}%${summary.totals.unknown_files ? " • ยอดอาจยังไม่ครบ" : ""}`}
              </span>
            </article>
            <article>
              <small>รูปหน้างาน</small>
              <strong>{summary.totals.photo_count} รูป</strong>
              <span>ไม่นับภาพตัวอย่างซ้ำเป็นรูปหน้างาน</span>
            </article>
          </div>
          {summary.quota_bytes !== null && (
            <progress
              className={`storage-total-progress storage-${storageLevel(summary)}`}
              value={Math.min(summary.totals.total_bytes, summary.quota_bytes)}
              max={summary.quota_bytes}
              aria-label="พื้นที่รูปเทียบกับโควตาบริษัท"
            />
          )}
          <section className="panel storage-breakdown">
            <h2>พื้นที่แยกตามโครงการ</h2>
            <p>
              รวมโครงการที่เสร็จแล้ว รูปในถังขยะ และเอกสารที่ยกเลิก
              เพราะไฟล์ยังใช้พื้นที่อยู่
            </p>
            <div className="storage-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>โครงการ</th>
                    <th>รูปหน้างาน</th>
                    <th>ภาพรายงาน/PDF</th>
                    <th>ภาพตัวอย่าง</th>
                    <th>รูปโครงการ</th>
                    <th>ไฟล์อื่น</th>
                    <th>รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.projects.map((p) => (
                    <tr key={p.project_id ?? "unassigned"}>
                      <td>
                        {p.project_name}
                        {p.project_status === "completed" && (
                          <small className="storage-row-note">เสร็จสิ้น</small>
                        )}
                        {p.unknown_files > 0 && (
                          <small className="storage-row-note">
                            ยังไม่ทราบขนาด {p.unknown_files} ไฟล์
                          </small>
                        )}
                      </td>
                      <td>{p.photo_count}</td>
                      <td>{formatStorage(p.report_bytes)}</td>
                      <td>{formatStorage(p.thumbnail_bytes)}</td>
                      <td>{formatStorage(p.cover_bytes)}</td>
                      <td>{formatStorage(p.other_bytes)}</td>
                      <td>
                        <b>{formatStorage(p.total_bytes)}</b>
                      </td>
                    </tr>
                  ))}
                  <tr className="storage-table-total">
                    <td>รวมทั้งบริษัท</td>
                    <td>{summary.totals.photo_count}</td>
                    <td>{formatStorage(summary.totals.report_bytes)}</td>
                    <td>{formatStorage(summary.totals.thumbnail_bytes)}</td>
                    <td>{formatStorage(summary.totals.cover_bytes)}</td>
                    <td>{formatStorage(summary.totals.other_bytes)}</td>
                    <td>
                      <b>{formatStorage(summary.totals.total_bytes)}</b>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              รวมอยู่ในยอดข้างต้นแล้ว: รูปในถังขยะ{" "}
              {formatStorage(summary.totals.trash_bytes)} • เอกสารที่ยกเลิก{" "}
              {formatStorage(summary.totals.cancelled_bytes)}
            </p>
            <p className="storage-footnote">
              ไฟล์อื่นคือไฟล์ที่ยังไม่เชื่อมกับรายการรูปหรือรูปโครงการปัจจุบัน
              หน้านี้ไม่ลบไฟล์ให้อัตโนมัติ
            </p>
          </section>
          {role === "owner" ? (
            <form
              className="panel storage-quota-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setFormError("");
                setMessage("");
                const quota =
                  quotaValue.trim() === ""
                    ? null
                    : Math.round(Number(quotaValue) * STORAGE_GB);
                if (
                  quota !== null &&
                  (!Number.isSafeInteger(quota) ||
                    quota < 1000000 ||
                    quota > 1000000000000000)
                ) {
                  setFormError(
                    "กำหนดโควตาตั้งแต่ 0.001 ถึง 1,000,000 GB หรือเว้นว่างเพื่อยังไม่กำหนด",
                  );
                  return;
                }
                setBusy(true);
                try {
                  if (demo) saveDemoQuota(quota);
                  else {
                    const { error } = await supabase!.rpc(
                      "set_company_photo_quota",
                      {
                        target_workspace: workspace,
                        new_quota_bytes: quota,
                        expected_quota_bytes: draft
                          ? draft.expected
                          : summary.quota_bytes,
                      },
                    );
                    if (error)
                      throw new Error(
                        error.code === "40001"
                          ? "โควตาถูกเปลี่ยนโดยผู้อื่น กรุณาโหลดค่าล่าสุดก่อนบันทึก"
                          : error.message,
                      );
                  }
                  setDraft(null);
                  setMessage("บันทึกโควตาแจ้งเตือนแล้ว");
                  refresh();
                } catch (e) {
                  setFormError(
                    e instanceof Error ? e.message : "บันทึกโควตาไม่สำเร็จ",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>กำหนดโควตาแจ้งเตือน — Owner</h2>
              <p>
                เป็นโควตารูปของบริษัทในแอป ไม่ใช่พื้นที่คงเหลือของแพ็กเกจ
                Supabase และไม่บล็อกการอัปโหลด
              </p>
              <label>
                โควตารูปของบริษัท (GB)
                <input
                  type="number"
                  min="0.001"
                  max="1000000"
                  step="0.001"
                  value={quotaValue}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({
                      value: e.target.value,
                      expected: draft ? draft.expected : summary.quota_bytes,
                    })
                  }
                />
              </label>
              <p>
                เว้นว่างเพื่อยังไม่กำหนดโควตา แจ้งเตือนในเว็บเมื่อใช้ถึง 80%,
                95% และ 100%
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="button primary" disabled={busy || loading}>
                  {busy ? "กำลังบันทึก…" : "บันทึกโควตาแจ้งเตือน"}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setDraft(null);
                    setFormError("");
                    setMessage("");
                    refresh();
                  }}
                >
                  โหลดค่าโควตาล่าสุด
                </button>
              </div>
              {formError && (
                <p className="error" role="alert">
                  {formError}
                </p>
              )}
              {message && <p role="status">{message}</p>}
            </form>
          ) : (
            <div className="panel">
              <p>เฉพาะ Owner ของบริษัทที่กำหนดหรือเปลี่ยนโควตาแจ้งเตือนได้</p>
            </div>
          )}
          <p className="storage-footnote">
            {demo
              ? "ข้อมูลตัวอย่างในเบราว์เซอร์"
              : `ตรวจล่าสุด ${new Date(summary.checked_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`}{" "}
            • สรุปจากข้อมูลไฟล์ใน Storage รวมรูปเดิม • ไม่รวมฐานข้อมูล PDF
            ที่ดาวน์โหลด หรือค่าใช้จ่ายในการรับส่งข้อมูล
          </p>
        </>
      )}
    </>
  );
}
