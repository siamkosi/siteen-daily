export type InvitationInput = {
  workspaceId: string;
  email: string;
  projectIds: string[];
  role: "editor" | "viewer";
  requestId: string;
  invitationId?: string;
  expectedVersion?: number;
};
export type Delivery = "sent" | "failed" | "unknown";
export type PreparedInvitation = {
  id: string;
  attempt_id?: string;
  email?: string;
  send: boolean;
  delivery_status?: string;
  row_version?: number;
};
export type InvitationPrincipal = {
  prepare: (input: InvitationInput) => Promise<PreparedInvitation>;
  complete: (
    attempt: string,
    result: Delivery,
    workspace: string,
  ) => Promise<void>;
};
type Services = {
  appOrigin?: string;
  authenticate: (token: string) => Promise<InvitationPrincipal | null>;
  send: (email: string, redirect: string) => Promise<Delivery>;
  log?: (stage: string) => void;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function reply(value: object, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(status === 429 ? { "Retry-After": "60" } : {}),
    },
  });
}
function input(value: unknown): value is InvitationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as InvitationInput;
  return (
    Object.keys(p).every((k) =>
      [
        "workspaceId",
        "email",
        "projectIds",
        "role",
        "requestId",
        "invitationId",
        "expectedVersion",
      ].includes(k),
    ) &&
    uuid.test(p.workspaceId ?? "") &&
    uuid.test(p.requestId ?? "") &&
    typeof p.email === "string" &&
    p.email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim()) &&
    ["editor", "viewer"].includes(p.role) &&
    Array.isArray(p.projectIds) &&
    p.projectIds.length > 0 &&
    p.projectIds.length <= 100 &&
    p.projectIds.every((p) => typeof p === "string" && uuid.test(p)) &&
    new Set(p.projectIds).size === p.projectIds.length &&
    (p.invitationId === undefined
      ? p.expectedVersion === undefined
      : uuid.test(p.invitationId) &&
        Number.isInteger(p.expectedVersion) &&
        p.expectedVersion! > 0)
  );
}
export function createInvitationHandler(services: Services) {
  return async function POST(request: Request) {
    let origin: string;
    try {
      const url = new URL(services.appOrigin ?? "");
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        url.username ||
        url.password ||
        (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
        request.headers.get("origin") !== url.origin
      )
        throw Error();
      origin = url.origin;
    } catch {
      return reply({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, 403);
    }
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer ([^\s]{1,16384})$/i)?.[1];
    if (!token) return reply({ error: "กรุณาเข้าสู่ระบบ" }, 401);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return reply({ error: "ต้องส่งข้อมูล JSON" }, 415);
    const declared = request.headers.get("content-length");
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > 16384))
      return reply({ error: "ข้อมูลใหญ่เกินกำหนด" }, 413);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "ไม่มีข้อมูล" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    let timeout = false;
    const timer = setTimeout(() => {
      timeout = true;
      void reader.cancel().catch(() => undefined);
    }, 8000);
    let body: unknown;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) {
          await reader.cancel();
          return reply({ error: "ข้อมูลใหญ่เกินกำหนด" }, 413);
        }
        chunks.push(value);
      }
      if (timeout) return reply({ error: "รับข้อมูลหมดเวลา" }, 408);
      const bytes = new Uint8Array(size);
      let pos = 0;
      for (const part of chunks) {
        bytes.set(part, pos);
        pos += part.length;
      }
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return reply({ error: "ข้อมูลไม่ถูกต้อง" }, 400);
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }
    if (!input(body))
      return reply({ error: "ตรวจอีเมล โครงการ และบทบาทอีกครั้ง" }, 400);
    let principal: InvitationPrincipal | null;
    try {
      principal = await services.authenticate(token);
    } catch {
      services.log?.("auth-unavailable");
      return reply({ error: "ตรวจสอบบัญชีไม่สำเร็จ" }, 503);
    }
    if (!principal)
      return reply({ error: "กรุณาเข้าสู่ระบบใหม่และยืนยันอีเมล" }, 401);
    let offer: PreparedInvitation;
    try {
      offer = await principal.prepare({
        ...body,
        email: body.email.trim().toLowerCase(),
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const status =
        code === "42501"
          ? 403
          : code === "P0429"
            ? 429
            : ["23505", "40001"].includes(code ?? "")
              ? 409
              : code === "22023"
                ? 400
                : 503;
      return reply(
        {
          error:
            status === 403
              ? "เฉพาะ Owner เท่านั้น"
              : status === 429
                ? "ส่งถี่เกินไป กรุณารอแล้วลองใหม่"
                : status === 409
                  ? "ข้อมูลเปลี่ยนหรือเป็นสมาชิกแล้ว กรุณาโหลดใหม่"
                  : "เตรียมคำเชิญไม่สำเร็จ",
        },
        status,
      );
    }
    if (!offer.send)
      return reply({
        id: offer.id,
        delivery_status: offer.delivery_status ?? "unknown",
        duplicate: true,
      });
    if (!offer.attempt_id || !offer.email) {
      services.log?.("invalid-prepare-result");
      return reply({ error: "เตรียมคำเชิญไม่สำเร็จ" }, 503);
    }
    let outcome: Delivery;
    try {
      outcome = await services.send(offer.email, `${origin}/auth/callback`);
    } catch {
      outcome = "unknown";
    }
    try {
      await principal.complete(offer.attempt_id, outcome, body.workspaceId);
    } catch {
      services.log?.("delivery-record-unavailable");
      outcome = "unknown";
    }
    return reply(
      { id: offer.id, delivery_status: outcome },
      outcome === "failed" ? 502 : outcome === "unknown" ? 202 : 200,
    );
  };
}
