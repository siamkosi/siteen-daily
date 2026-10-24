import { test, expect } from "@playwright/test";
import {
  createPdfHandler,
  type PdfServices,
  type PdfPayload,
} from "../src/lib/server/pdf-handler";
import { createPdfAuthenticator } from "../src/lib/server/pdf-auth";
import { passwordRecoveryUrl } from "../src/lib/recovery-url";
const origin = "http://127.0.0.1:3100";
const document = {
  kind: "report" as const,
  id: "30000000-0000-4000-8000-000000000001",
  workspaceId: "20000000-0000-4000-8000-000000000001",
};
const payload: PdfPayload = {
  html: '<article class="print-report">Test</article>',
  css: "",
  filename: "test",
  document,
};
function setup(overrides: Partial<PdfServices> = {}) {
  const state = { rendered: 0, released: 0, acquired: 0, read: 0 };
  const handler = createPdfHandler({
    appOrigin: origin,
    authenticate: async (token) =>
      token === "valid-token"
        ? {
            canRead: async () => {
              state.read++;
              return true;
            },
            acquire: async () => {
              state.acquired++;
              return {
                allowed: true,
                lease_id: "40000000-0000-4000-8000-000000000001",
                retry_after: 0,
                reason: "ok",
              };
            },
            release: async () => {
              state.released++;
            },
          }
        : null,
    render: async () => {
      state.rendered++;
      return new TextEncoder().encode("%PDF-test");
    },
    ...overrides,
  });
  return { handler, state };
}
function request(
  body: unknown = payload,
  headers: Record<string, string> = {},
  url = origin + "/api/reports/pdf",
) {
  return new Request(url, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Authorization: "Bearer valid-token",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
test("recovery callback follows local ports and HTTPS production origin with a fixed path", () => {
  expect(passwordRecoveryUrl("http://127.0.0.1:3100")).toBe(
    "http://127.0.0.1:3100/update-password",
  );
  expect(
    passwordRecoveryUrl(
      "https://daily.example.com/login?next=https://other.example",
    ),
  ).toBe("https://daily.example.com/update-password");
});
test("public PDF route rejects same-origin anonymous and forged tokens before rendering", async ({
  request: api,
}) => {
  const noAuth = await api.post("/api/reports/pdf", {
    headers: { Origin: origin },
    data: payload,
  });
  expect(noAuth.status()).toBe(401);
  const badAuth = await api.post("/api/reports/pdf", {
    headers: {
      Origin: origin,
      Authorization: "Bearer invalid-readiness-token",
    },
    data: payload,
  });
  expect(badAuth.status()).toBe(401);
});
test("handler denies invalid token, cross-origin, missing origin and unconfigured public origins", async () => {
  const { handler, state } = setup();
  expect((await handler(request(payload, { Authorization: "" }))).status).toBe(
    401,
  );
  expect(
    (await handler(request(payload, { Authorization: "Bearer expired-token" })))
      .status,
  ).toBe(401);
  expect(
    (await handler(request(payload, { Origin: "https://other.example" })))
      .status,
  ).toBe(403);
  expect((await handler(request(payload, { Origin: "" }))).status).toBe(403);
  expect(
    (
      await handler(
        request(
          payload,
          { Origin: "https://daily.example.com" },
          "https://daily.example.com/api/reports/pdf",
        ),
      )
    ).status,
  ).toBe(403);
  expect(state.rendered).toBe(0);
});
test("canonical HTTPS origin works behind a proxy; forwarded host cannot expand it", async () => {
  const { handler } = setup({ appOrigin: "https://daily.example.com" });
  expect(
    (
      await handler(
        request(
          payload,
          { Origin: "https://daily.example.com" },
          "http://internal:3000/api/reports/pdf",
        ),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await handler(
        request(
          payload,
          {
            Origin: "https://evil.example",
            "X-Forwarded-Host": "daily.example.com",
          },
          "http://internal:3000/api/reports/pdf",
        ),
      )
    ).status,
  ).toBe(403);
});
test("foreign or revoked document access is denied before quota or rendering", async () => {
  const { handler, state } = setup({
    authenticate: async () => ({
      canRead: async () => false,
      acquire: async () => {
        throw new Error("must not acquire");
      },
      release: async () => {},
    }),
  });
  expect((await handler(request())).status).toBe(403);
  expect(state.rendered).toBe(0);
});
test("quota and busy responses return Retry-After without rendering", async () => {
  for (const reason of ["rate", "user_busy", "global_busy"]) {
    const { handler, state } = setup({
      authenticate: async () => ({
        canRead: async () => true,
        acquire: async () => ({
          allowed: false,
          lease_id: null,
          retry_after: 12,
          reason,
        }),
        release: async () => {},
      }),
    });
    const response = await handler(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(state.rendered).toBe(0);
  }
});
test("authenticated export releases its lease on success and renderer failure", async () => {
  const ok = setup();
  const response = await ok.handler(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).toBe("%PDF-test");
  expect(ok.state.released).toBe(1);
  const failed = setup({
    render: async () => {
      throw new Error("private details must not leak");
    },
  });
  const error = await failed.handler(request());
  expect(error.status).toBe(503);
  expect(await error.text()).not.toContain("private details");
  expect(failed.state.released).toBe(1);
});
test("Auth and quota failure fail closed", async () => {
  expect(
    (
      await setup({
        authenticate: async () => {
          throw new Error("unavailable");
        },
      }).handler(request())
    ).status,
  ).toBe(503);
  const service = setup({
    authenticate: async () => ({
      canRead: async () => true,
      acquire: async () => {
        throw new Error("quota offline");
      },
      release: async () => {},
    }),
  });
  expect((await service.handler(request())).status).toBe(503);
  expect(service.state.rendered).toBe(0);
});
test("payload identity, content type, and both declared/streaming body limits are checked", async () => {
  const { handler, state } = setup();
  expect(
    (
      await handler(
        request({ ...payload, document: { ...document, id: "invalid" } }),
      )
    ).status,
  ).toBe(400);
  expect(
    (await handler(request(payload, { "Content-Type": "text/plain" }))).status,
  ).toBe(415);
  expect(
    (
      await handler(
        request(payload, { "Content-Length": String(33 * 1024 * 1024) }),
      )
    ).status,
  ).toBe(413);
  const large = new Request(origin + "/api/reports/pdf", {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer valid-token",
      "Content-Type": "application/json",
    },
    body: "x".repeat(32 * 1024 * 1024 + 1),
  });
  expect((await handler(large)).status).toBe(413);
  expect(state.rendered).toBe(0);
});
for (const role of ["owner", "editor", "viewer"])
  test(`SDK server auth validates ${role} with Auth and RLS using caller JWT`, async () => {
    const calls: string[] = [];
    const auth = createPdfAuthenticator({
      url: "https://supabase.example",
      key: "publishable-test",
      fetch: async (input, init) => {
        const url = String(input);
        calls.push(url);
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Bearer valid-token",
        );
        if (url.includes("/auth/v1/user"))
          return Response.json({
            id: "10000000-0000-4000-8000-000000000001",
            aud: "authenticated",
            role: "authenticated",
            app_metadata: { role: "untrusted" },
            user_metadata: { role: "owner" },
            is_anonymous: false,
          });
        if (url.includes("/daily_reports")) {
          expect(url).toContain(`workspace_id=eq.${document.workspaceId}`);
          expect(url).toContain("deleted_at=is.null");
          return Response.json({ id: document.id, status: "submitted" });
        }
        if (url.includes("/begin_pdf_export"))
          return Response.json([
            {
              allowed: true,
              lease_id: "40000000-0000-4000-8000-000000000001",
              retry_after: 0,
              reason: "ok",
            },
          ]);
        return Response.json(null);
      },
    });
    const principal = await auth("valid-token");
    expect(principal).not.toBeNull();
    expect(await principal!.canRead(document)).toEqual({ cancelled: false });
    const lease = await principal!.acquire();
    await principal!.release(lease.lease_id!);
    expect(calls.some((u) => u.includes("/auth/v1/user"))).toBe(true);
  });
test("SDK rejects anonymous users and Auth rejects tampered tokens", async () => {
  for (const kind of ["anonymous", "invalid"]) {
    const auth = createPdfAuthenticator({
      url: "https://supabase.example",
      key: "publishable-test",
      fetch: async () =>
        kind === "invalid"
          ? Response.json(
              { message: "invalid JWT", error_code: "bad_jwt" },
              { status: 401 },
            )
          : Response.json({
              id: "10000000-0000-4000-8000-000000000001",
              is_anonymous: true,
            }),
    });
    expect(await auth("bad-token")).toBeNull();
  }
});
test("demo cannot send an anonymous export request", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/reports/pdf", (route) => {
    calls++;
    return route.fulfill({ status: 401, json: { error: "login required" } });
  });
  await page.goto("/login");
  await page
    .getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" })
    .click();
  await page
    .getByRole("link", { name: /Daily Report/ })
    .first()
    .click();
  await page
    .getByRole("link", { name: /เปิดรายงาน 20/ })
    .first()
    .click();
  await page.getByRole("button", { name: "ส่งออก PDF", exact: true }).click();
  await expect(page.locator('.error[role="alert"]')).toContainText("บัญชีจริง");
  expect(calls).toBe(0);
});

test("PDF cancellation state comes from authorized DB access, not caller JSON", async () => {
  let rendered: PdfPayload | undefined;
  const { handler } = setup({
    authenticate: async () => ({
      canRead: async () => ({ cancelled: true }),
      acquire: async () => ({
        allowed: true,
        lease_id: crypto.randomUUID(),
        retry_after: 0,
        reason: "ok",
      }),
      release: async () => {},
    }),
    render: async (value) => {
      rendered = value;
      return new Uint8Array([37, 80, 68, 70]);
    },
  });
  expect(
    (await handler(request({ ...payload, cancellation: { cancelled: false } })))
      .status,
  ).toBe(200);
  expect(rendered?.cancellation).toEqual({ cancelled: true });
});
