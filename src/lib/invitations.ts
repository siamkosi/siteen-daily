export type Cursor = { created_at: string; id: string } | null;
export type Invitation = {
  id: string;
  workspace_id: string;
  company_name: string;
  email: string;
  role: "editor" | "viewer";
  projects: { id: string; name: string }[];
  status: string;
  delivery_status: string;
  expires_at: string;
  created_at: string;
  row_version: number;
};
export type AccessEvent = {
  id: string;
  action: string;
  actor_id: string | null;
  occurred_at?: string;
  created_at: string;
  details: Record<string, unknown>;
};
export type PageResult<T> = { items: T[]; next_cursor: Cursor };
export const cursorArgs = (cursor: Cursor) => ({
  before_created: cursor?.created_at ?? null,
  before_id: cursor?.id ?? null,
});
export function invitationError(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "40001"
    ? "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่ก่อนลองอีกครั้ง"
    : code === "42501"
      ? "ไม่มีสิทธิ์ หรืออีเมลยังไม่ยืนยัน / ไม่ตรงกับคำเชิญ"
      : code === "22023"
        ? "คำเชิญหมดอายุ ยกเลิกแล้ว หรือข้อมูลไม่ถูกต้อง"
        : "ดำเนินการไม่สำเร็จ กรุณาโหลดใหม่เพื่อตรวจสถานะ";
}
