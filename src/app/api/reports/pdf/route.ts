import { createPdfHandler } from "@/lib/server/pdf-handler";
import { createPdfAuthenticator } from "@/lib/server/pdf-auth";
import { renderPdf } from "@/lib/server/pdf-renderer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createPdfHandler({
  appOrigin: process.env.APP_ORIGIN,
  authenticate: createPdfAuthenticator({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }),
  render: renderPdf,
  // Stage codes only: never log tokens, report contents or signed URLs.
  log: (stage) => console.error(`[pdf] ${stage}`),
});
