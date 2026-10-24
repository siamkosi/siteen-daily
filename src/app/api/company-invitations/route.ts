import { createInvitationHandler } from "@/lib/server/invitation-handler";
import {
  createInvitationAuthenticator,
  createInvitationSender,
} from "@/lib/server/invitation-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const config = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};
export const POST = createInvitationHandler({
  appOrigin: process.env.APP_ORIGIN,
  authenticate: createInvitationAuthenticator(config),
  send: createInvitationSender(config),
  log: (stage) => console.error("invitation", stage),
});
