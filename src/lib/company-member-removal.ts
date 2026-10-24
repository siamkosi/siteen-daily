import type { ProjectRole } from "./project-access";
export type MemberRemovalPreview = {
  workspace_id: string;
  company_name: string;
  user_id: string;
  email: string;
  membership_version: string;
  assignments_hash: string;
  projects: { id: string; name: string; role: ProjectRole }[];
};
export function isMemberRemovalPreview(
  value: unknown,
  workspace: string,
  user: string,
): value is MemberRemovalPreview {
  if (!value || typeof value !== "object") return false;
  const p = value as MemberRemovalPreview;
  return (
    p.workspace_id === workspace &&
    p.user_id === user &&
    typeof p.company_name === "string" &&
    typeof p.email === "string" &&
    typeof p.membership_version === "string" &&
    /^[0-9a-f-]{36}$/i.test(p.membership_version) &&
    typeof p.assignments_hash === "string" &&
    /^[a-f0-9]{32}$/.test(p.assignments_hash) &&
    Array.isArray(p.projects) &&
    p.projects.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        ["editor", "viewer"].includes(item.role),
    )
  );
}
export function memberRemovalError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "40001")
    return "สมาชิกหรือสิทธิ์โครงการเปลี่ยนแล้ว กรุณาโหลดรายชื่อใหม่และยืนยันอีกครั้ง";
  if (code === "42501")
    return "นำสมาชิกออกไม่ได้ กรุณาตรวจสิทธิ์ Owner และการยืนยันอีเมล ไม่สามารถนำ Owner ออกได้";
  if (code === "22023") return "ข้อมูลยืนยันไม่ครบ กรุณาโหลดรายชื่อใหม่";
  return "ยังยืนยันผลการนำออกไม่ได้ กรุณาโหลดรายชื่อใหม่เพื่อตรวจสถานะก่อนลองอีกครั้ง";
}
