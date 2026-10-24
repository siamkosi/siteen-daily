// Isolated browser-test boundary: never imported by application code.
import { expect, type Page } from "@playwright/test";
import { createPdfHandler } from "../src/lib/server/pdf-handler";
import { renderPdf } from "../src/lib/server/pdf-renderer";
const token = "fixture-authenticated-export-token";
export async function installPdfExportFixture(page: Page, cancelled = false) {
  await page.evaluate((token) => {
    localStorage.setItem(
      "sb-hvcwskmqwvrjsrysllly-auth-token",
      JSON.stringify({
        access_token: token,
        refresh_token: "fixture-only",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: 4102444800,
        user: {
          id: "22222222-2222-4222-8222-222222222222",
          email: "fixture@example.test",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
        },
      }),
    );
  }, token);
  const handler = createPdfHandler({
    appOrigin: "http://127.0.0.1:3100",
    authenticate: async (value) =>
      value === token
        ? {
            canRead: async (document) =>
              document.workspaceId === "11111111-1111-4111-8111-111111111111"
                ? { cancelled }
                : false,
            acquire: async () => ({
              allowed: true,
              lease_id: crypto.randomUUID(),
              retry_after: 0,
              reason: "ok",
            }),
            release: async () => {},
          }
        : null,
    render: renderPdf,
  });
  await page.route("**/api/reports/pdf", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBe(`Bearer ${token}`);
    const response = await handler(
      new Request(request.url(), {
        method: "POST",
        headers: request.headers(),
        body: request.postData(),
      }),
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}
