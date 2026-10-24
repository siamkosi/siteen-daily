// Process health only; never launches Chromium or returns environment/DB details.
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    { status: "ok" },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
