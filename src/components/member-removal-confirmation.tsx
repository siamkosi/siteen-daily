"use client";
import type { MemberRemovalPreview } from "@/lib/company-member-removal";
export function MemberRemovalConfirmation({
  snapshot,
  busy,
  onCancel,
  onConfirm,
}: {
  snapshot: MemberRemovalPreview;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="invitation-item"
      role="region"
      aria-label="ยืนยันนำสมาชิกออก"
    >
      <h3>ยืนยันนำสมาชิกออก</h3>
      <p>
        <b>{snapshot.email}</b> จากบริษัท <b>{snapshot.company_name}</b>
      </p>
      <p>
        สมาชิกจะเข้าโครงการของบริษัทนี้ไม่ได้ รายงาน รูป และประวัติเดิมยังอยู่
        บัญชีและสมาชิกในบริษัทอื่นยังใช้งานได้
      </p>
      {snapshot.projects.length ? (
        <>
          <p>โครงการที่จะถอนสิทธิ์:</p>
          <ul>
            {snapshot.projects.map((p) => (
              <li key={p.id}>
                {p.name} — {p.role}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>ไม่มีโครงการที่มอบหมายอยู่ในขณะนี้</p>
      )}
      <p>
        คำเชิญที่ยังค้างของอีเมลนี้ในบริษัทจะถูกยกเลิก
        หากต้องการกลับเข้าร่วมต้องให้ Owner เชิญใหม่
      </p>
      <p className="muted">
        ลิงก์รูปที่เปิดไปแล้วอาจใช้ได้จนหมดอายุไม่เกินหนึ่งชั่วโมง
      </p>
      <button className="button secondary" disabled={busy} onClick={onCancel}>
        ยกเลิกการนำออก
      </button>{" "}
      <button
        className="button secondary danger"
        disabled={busy}
        onClick={onConfirm}
      >
        {busy ? "กำลังนำออก…" : "ยืนยันนำสมาชิกออก"}
      </button>
    </div>
  );
}
