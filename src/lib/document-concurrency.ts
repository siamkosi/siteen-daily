// This version belongs to the snapshot opened in the editor, never a later fetch.
export class DocumentConflictError extends Error {
  constructor() {
    super(
      "เอกสารนี้มีการเปลี่ยนแปลงหลังจากที่คุณเปิดแก้ไข ระบบไม่ได้บันทึกทับ กรุณาตรวจฉบับล่าสุดก่อนบันทึกอีกครั้ง",
    );
    this.name = "DocumentConflictError";
  }
}

export function requireDocumentVersion(version: number | undefined): number {
  if (
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1
  )
    throw new DocumentConflictError();
  return version;
}

export function documentSaveError(error: { code?: string; message: string }) {
  if (error.code === "40001" || error.code === "PGRST116")
    return new DocumentConflictError();
  return new Error(error.message);
}
