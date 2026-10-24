import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { pdfBrowserOptions, renderPdf } from "../src/lib/server/pdf-renderer";
import {
  validatePublicEnv,
  validateRuntimeEnv,
} from "../scripts/check-container-env.mjs";
import { GET as health } from "../src/app/api/health/route";

test("PDF browser defaults and Linux sandbox fail closed", () => {
  expect(pdfBrowserOptions({}, "win32").channel).toBe("msedge");
  expect(pdfBrowserOptions({}, "linux")).toMatchObject({
    channel: "chromium",
    chromiumSandbox: true,
  });
  expect(pdfBrowserOptions({ PDF_BROWSER: "chromium" }, "win32").channel).toBe(
    "chromium",
  );
  expect(() =>
    pdfBrowserOptions({ PDF_BROWSER: "arbitrary-command" }, "linux"),
  ).toThrow("PDF_BROWSER");
  expect(() =>
    pdfBrowserOptions({ PDF_CHROMIUM_SANDBOX: "typo" }, "linux"),
  ).toThrow("true or false");
  expect(() =>
    pdfBrowserOptions(
      { PDF_CHROMIUM_SANDBOX: "false", NODE_ENV: "production" },
      "linux",
    ),
  ).toThrow("requires its sandbox");
});

test("container refuses unsafe keys, mismatched build/runtime and invalid origins", () => {
  const valid = {
    NEXT_PUBLIC_SUPABASE_URL: "https://container-test.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake_container_test",
    APP_ORIGIN: "https://daily.example.test",
    PDF_BROWSER: "chromium",
    PDF_CHROMIUM_SANDBOX: "true",
  };
  const built = validatePublicEnv(valid);
  expect(() => validateRuntimeEnv(valid, built)).not.toThrow();
  const serviceToken = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  for (const key of ["", "sb_secret_do_not_use", serviceToken])
    expect(() =>
      validatePublicEnv({
        ...valid,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
      }),
    ).toThrow("publishable/anon");
  expect(() =>
    validateRuntimeEnv(
      { ...valid, NEXT_PUBLIC_SUPABASE_URL: "https://different.supabase.co" },
      built,
    ),
  ).toThrow("rebuild");
  for (const origin of [
    "",
    "http://daily.example.test",
    "https://daily.example.test/path",
    "https://daily.example.test/",
    "https://user:password@daily.example.test",
  ])
    expect(() =>
      validateRuntimeEnv({ ...valid, APP_ORIGIN: origin }, built),
    ).toThrow("APP_ORIGIN");
  expect(() =>
    validateRuntimeEnv(
      { ...valid, APP_ORIGIN: "http://127.0.0.1:3000" },
      built,
    ),
  ).not.toThrow();
  expect(() =>
    validateRuntimeEnv({ ...valid, PDF_CHROMIUM_SANDBOX: "false" }, built),
  ).toThrow("PDF_CHROMIUM_SANDBOX");
});

test("health is cheap and does not reveal deployment configuration", async () => {
  const response = health();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});

test("renderer blocks external image requests and fails instead of omitting broken images", async () => {
  let requests = 0;
  const server = createServer((_req, res) => {
    requests++;
    res.end("unexpected network request");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  try {
    await expect(
      renderPdf({
        document: {
          kind: "report",
          id: "11111111-1111-4111-8111-111111111111",
          workspaceId: "22222222-2222-4222-8222-222222222222",
        },
        filename: "network-denied",
        css: "",
        html: `<div class="print-report"><img src="http://127.0.0.1:${port}/private"><script>fetch('http://127.0.0.1:${port}/script')</script></div>`,
      }),
    ).rejects.toThrow();
    expect(requests).toBe(0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
