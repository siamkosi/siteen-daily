import { createClient } from "@supabase/supabase-js";
import type {
  Delivery,
  InvitationPrincipal,
  PreparedInvitation,
} from "./invitation-handler";
type Config = { url?: string; key?: string; fetch?: typeof fetch };
const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};
function timedFetch(config: Config): typeof fetch {
  return (url, init) =>
    (config.fetch ?? fetch)(url, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    });
}
export function createInvitationAuthenticator(config: Config) {
  return async (token: string): Promise<InvitationPrincipal | null> => {
    if (!config.url || !config.key) throw Error("Auth not configured");
    const client = createClient(config.url, config.key, {
      auth: authOptions,
      global: {
        fetch: timedFetch(config),
        headers: { Authorization: `Bearer ${token}` },
      },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error) {
      if ([400, 401, 403].includes(error.status ?? 0)) return null;
      throw Error("Auth unavailable");
    }
    if (!data.user || data.user.is_anonymous || !data.user.email_confirmed_at)
      return null;
    return {
      async prepare(p) {
        const { data, error } = await client.rpc("prepare_company_invitation", {
          target_workspace: p.workspaceId,
          target_email: p.email,
          target_projects: p.projectIds,
          new_role: p.role,
          request_id: p.requestId,
          existing_invitation: p.invitationId ?? null,
          expected_version: p.expectedVersion ?? null,
        });
        if (error) throw error;
        return data as PreparedInvitation;
      },
      async complete(attempt, result, workspace) {
        const { error } = await client.rpc(
          "complete_company_invitation_delivery",
          {
            target_workspace: workspace,
            target_attempt: attempt,
            delivery_result: result,
          },
        );
        if (error) throw error;
      },
    };
  };
}
// Separate public-key client: never send the Owner's bearer to recipient Auth.
export function createInvitationSender(config: Config) {
  return async (email: string, redirect: string): Promise<Delivery> => {
    if (!config.url || !config.key) return "failed";
    const sender = createClient(config.url, config.key, {
      auth: authOptions,
      global: { fetch: timedFetch(config) },
    });
    try {
      const { error } = await sender.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirect, shouldCreateUser: true },
      });
      if (!error) return "sent";
      // 5xx or transport failures may have accepted mail; never claim failure safely retryable.
      return error.status && error.status >= 400 && error.status < 500
        ? "failed"
        : "unknown";
    } catch {
      return "unknown";
    }
  };
}
