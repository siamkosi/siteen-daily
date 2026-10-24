export type PdfDocument = {
  kind: "report" | "request";
  id: string;
  workspaceId: string;
};
export type PdfPayload = {
  cancellation?: { cancelled: boolean };
  html: string;
  css: string;
  filename?: string;
  document: PdfDocument;
};
export type PdfAdmission = {
  allowed: boolean;
  lease_id: string | null;
  retry_after: number;
  reason: string;
};
export type PdfPrincipal = {
  canRead: (document: PdfDocument) => Promise<boolean | { cancelled: boolean }>;
  acquire: () => Promise<PdfAdmission>;
  release: (lease: string) => Promise<void>;
};
export type PdfServices = {
  authenticate: (token: string) => Promise<PdfPrincipal | null>;
  render: (payload: PdfPayload) => Promise<Uint8Array>;
  appOrigin?: string;
  log?: (stage: string) => void;
};
const limit = 32 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function failure(message: string, status: number, retryAfter?: number) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}
function allowedOrigin(request: Request, configured?: string) {
  try {
    if (!configured) return false;
    const target = new URL(configured);
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname);
    if (target.protocol !== "https:" && !(local && target.protocol === "http:"))
      return false;
    const rawOrigin = request.headers.get("origin") || "";
    const source = new URL(rawOrigin);
    return (
      rawOrigin === source.origin &&
      source.origin === target.origin &&
      !source.username &&
      !source.password
    );
  } catch {
    return false;
  }
}
function validPayload(value: unknown): value is PdfPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<PdfPayload>;
  return (
    typeof p.html === "string" &&
    p.html.includes("print-report") &&
    typeof p.css === "string" &&
    (p.filename === undefined || typeof p.filename === "string") &&
    !!p.document &&
    ["report", "request"].includes(p.document.kind) &&
    uuid.test(p.document.id ?? "") &&
    uuid.test(p.document.workspaceId ?? "")
  );
}

// Only the server supplies these dependencies; HTTP callers cannot replace them.
export function createPdfHandler(services: PdfServices) {
  return async function POST(request: Request) {
    if (!allowedOrigin(request, services.appOrigin))
      return failure("ไม่อนุญาตคำขอจากเว็บไซต์อื่น", 403);
    const match = request.headers
      .get("authorization")
      ?.match(/^Bearer ([^\s]{1,16384})$/i);
    if (!match) return failure("กรุณาเข้าสู่ระบบก่อนส่งออก PDF", 401);
    let principal: PdfPrincipal | null;
    try {
      principal = await services.authenticate(match[1]);
    } catch {
      services.log?.("auth-unavailable");
      return failure("ตรวจสอบบัญชีไม่สำเร็จ กรุณาลองใหม่", 503);
    }
    if (!principal)
      return failure("เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่", 401);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return failure("รูปแบบข้อมูลไม่ถูกต้อง", 415);
    const declared = request.headers.get("content-length");
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
      return failure("ข้อมูลรูปภาพรวมใหญ่เกิน 32 MB กรุณาลดขนาดรูป", 413);
    const reader = request.body?.getReader();
    if (!reader) return failure("ไม่มีข้อมูลรายงาน", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      void reader.cancel().catch(() => undefined);
    }, 15000);
    let value: unknown;
    try {
      while (true) {
        const part = await reader.read();
        if (timedOut)
          return failure("รับข้อมูลรายงานนานเกินไป กรุณาลองใหม่", 408);
        if (part.done) break;
        size += part.value.byteLength;
        if (size > limit) {
          await reader.cancel();
          return failure("ข้อมูลรูปภาพรวมใหญ่เกิน 32 MB กรุณาลดขนาดรูป", 413);
        }
        chunks.push(part.value);
      }
      value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return failure("ข้อมูลรายงานไม่ถูกต้อง", 400);
    } finally {
      clearTimeout(timer);
    }
    if (!validPayload(value))
      return failure("ไม่มีข้อมูลเอกสารสำหรับส่งออก", 400);
    let lease: string | null = null;
    try {
      const access = await principal.canRead(value.document);
      if (!access)
        return failure("ไม่มีสิทธิ์อ่านเอกสารนี้หรือไม่พบเอกสาร", 403);
      const admission = await principal.acquire();
      if (!admission.allowed) {
        const retry = Math.max(1, Math.ceil(admission.retry_after));
        return failure(
          admission.reason === "rate"
            ? `ส่งออก PDF ถี่เกินไป กรุณารอ ${retry} วินาที`
            : `มีงาน PDF กำลังทำงาน กรุณาลองใหม่ใน ${retry} วินาที`,
          429,
          retry,
        );
      }
      if (!admission.lease_id) throw new Error("Missing export lease");
      lease = admission.lease_id;
      // HTTP callers cannot suppress the DB-authorized cancellation watermark.
      const pdf = await services.render({
        ...value,
        cancellation: typeof access === "object" ? access : undefined,
      });
      const filename =
        (value.filename || "daily-report")
          .replace(/[^a-zA-Z0-9_.-]/g, "_")
          .slice(0, 120)
          .replace(/\.pdf$/i, "") + ".pdf";
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      services.log?.(
        lease ? "render-failed" : "authorization-or-quota-unavailable",
      );
      return failure(
        lease
          ? "ส่งออก PDF ไม่สำเร็จ กรุณาลองใหม่หรือตรวจว่าบริการสร้าง PDF พร้อมใช้งาน"
          : "ตรวจสอบสิทธิ์หรือคิว PDF ไม่สำเร็จ กรุณาลองใหม่",
        503,
      );
    } finally {
      if (lease)
        try {
          await principal.release(lease);
        } catch {
          services.log?.("lease-release-failed");
        }
    }
  };
}
