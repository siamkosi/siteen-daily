import { createClient } from "@supabase/supabase-js";
import type { PdfAdmission, PdfPrincipal } from "./pdf-handler";

export function createPdfAuthenticator(config: {
  url?: string;
  key?: string;
  fetch?: typeof fetch;
}) {
  return async (token: string): Promise<PdfPrincipal | null> => {
    if (!config.url || !config.key)
      throw new Error("PDF Auth is not configured");
    const client = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch:
          config.fetch ??
          ((input, init) =>
            fetch(input, {
              ...init,
              signal: init?.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)])
                : AbortSignal.timeout(8000),
            })),
        headers: { Authorization: `Bearer ${token}` },
      },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error) {
      if ([400, 401, 403].includes(error.status ?? 0)) return null;
      throw new Error("Auth service unavailable");
    }
    if (!data.user || data.user.is_anonymous) return null;
    return {
      async canRead(document) {
        const result = await client
          .from(
            document.kind === "request" ? "daily_requests" : "daily_reports",
          )
          .select("id,status")
          .eq("id", document.id)
          .eq("workspace_id", document.workspaceId)
          .is("deleted_at", null)
          .maybeSingle();
        if (result.error) throw new Error("Document authorization unavailable");
        return result.data
          ? { cancelled: result.data.status === "cancelled" }
          : false;
      },
      async acquire() {
        const { data, error } = await client.rpc("begin_pdf_export");
        if (error) throw new Error("PDF quota unavailable");
        const row = (Array.isArray(data) ? data[0] : data) as
          PdfAdmission | undefined;
        if (
          !row ||
          typeof row.allowed !== "boolean" ||
          !Number.isFinite(row.retry_after) ||
          (row.allowed && typeof row.lease_id !== "string")
        )
          throw new Error("Invalid PDF quota result");
        return row;
      },
      async release(lease) {
        const { error } = await client.rpc("finish_pdf_export", {
          target_lease: lease,
        });
        if (error) throw new Error("PDF lease release unavailable");
      },
    };
  };
}
