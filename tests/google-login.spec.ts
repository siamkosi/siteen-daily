import { test, expect, type Page } from "@playwright/test";
import { googleCallbackUrl } from "../src/lib/google-auth";

const company = "dcf175be-9fe4-49cb-a4e5-f2fdf88a41d5";
const userId = "f0eed677-bb05-4863-9b9a-30164206b61f";
const user = {
  id: userId,
  email: "siamkosi@gmail.com",
  email_confirmed_at: "2026-10-24T00:00:00Z",
  aud: "authenticated",
  role: "authenticated",
  last_sign_in_at: "2026-10-24T08:00:00Z",
  app_metadata: { provider: "google", providers: ["email", "google"] },
  user_metadata: {},
};
const part = (v: unknown) =>
  Buffer.from(JSON.stringify(v)).toString("base64url");
const token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: userId, exp: 4102444800, role: "authenticated", aud: "authenticated" })}.signature`;

async function appApi(page: Page, role: "owner" | "editor" | null = "owner") {
  await page.route("**/auth/v1/user", (route) => route.fulfill({ json: user }));
  await page.route("**/rest/v1/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/memberships")) {
      expect(url.searchParams.get("user_id")).toBe(`eq.${userId}`);
      return route.fulfill({
        json: role
          ? [
              {
                workspace_id: company,
                role,
                workspaces: { id: company, name: "27 วิศวกรรม — ข้อมูลสมมติ" },
              },
            ]
          : [],
      });
    }
    return route.fulfill({ json: [] });
  });
}

test("Google callback URL stays on the current HTTPS/local origin", () => {
  expect(googleCallbackUrl("http://127.0.0.1:3000")).toBe(
    "http://127.0.0.1:3000/auth/callback",
  );
  expect(
    googleCallbackUrl("https://daily.example.test/path?next=https://evil.test"),
  ).toBe("https://daily.example.test/auth/callback");
  expect(() => googleCallbackUrl("http://daily.example.test")).toThrow("HTTPS");
});

test("Google unavailable and network failures explain retry without leaving password login", async ({
  page,
}) => {
  let unavailable = true;
  let authorizations = 0;
  await page.route("**/auth/v1/settings", (route) =>
    unavailable
      ? route.fulfill({ json: { external: { google: false } } })
      : route.fulfill({ status: 503, json: { message: "private diagnostic" } }),
  );
  await page.route("**/auth/v1/authorize**", (route) => {
    authorizations++;
    return route.abort();
  });
  await page.goto("/login");
  const google = page.getByRole("button", {
    name: "เข้าสู่ระบบด้วย Google",
    exact: true,
  });
  await google.click();
  await expect(page.locator('.error[role="status"]')).toContainText(
    "ยังไม่ได้เปิดเข้าสู่ระบบด้วย Google",
  );
  await expect(google).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }),
  ).toBeEnabled();
  unavailable = false;
  await google.click();
  await expect(page.locator('.error[role="status"]')).toContainText(
    "กรุณาลองอีกครั้ง",
  );
  await expect(page.locator('.error[role="status"]')).not.toContainText(
    "private diagnostic",
  );
  expect(authorizations).toBe(0);
  await page
    .getByRole("button", { name: "ยังไม่มีบัญชี? สร้างบัญชี", exact: true })
    .click();
  await expect(google).toBeVisible();
});

for (const role of ["owner", "editor", null] as const) {
  test(`Google login callback keeps existing company permissions: ${role ?? "no membership"}`, async ({
    page,
  }) => {
    await appApi(page, role);
    await page.route("**/auth/v1/settings", (route) =>
      route.fulfill({ json: { external: { google: true } } }),
    );
    let authorizeUrl: URL | undefined;
    await page.route("**/auth/v1/authorize**", async (route) => {
      authorizeUrl = new URL(route.request().url());
      expect(authorizeUrl.searchParams.get("provider")).toBe("google");
      expect(authorizeUrl.searchParams.get("prompt")).toBe("select_account");
      expect(authorizeUrl.searchParams.get("redirect_to")).toBe(
        "http://127.0.0.1:3100/auth/callback",
      );
      expect(authorizeUrl.searchParams.get("scopes") ?? "").not.toContain(
        "gmail",
      );
      const callback = new URL(authorizeUrl.searchParams.get("redirect_to")!);
      callback.searchParams.set("next", "https://evil.example.test");
      callback.hash = new URLSearchParams({
        access_token: token,
        refresh_token: "test-only",
        token_type: "bearer",
        expires_in: "3600",
        provider_token: "test-provider-token",
      }).toString();
      return route.fulfill({
        status: 302,
        headers: { Location: callback.toString() },
        body: "",
      });
    });
    await page.goto("/login");
    await page
      .getByRole("button", { name: "เข้าสู่ระบบด้วย Google", exact: true })
      .click();
    await expect(page).toHaveURL("http://127.0.0.1:3100/dashboard");
    expect(authorizeUrl).toBeDefined();
    if (role) {
      await expect(
        page.getByRole("combobox", { name: "เลือกบริษัท" }),
      ).toHaveValue(company);
      await expect(page.locator(".profile")).toContainText(user.email);
      await expect(page.locator(".profile")).toContainText(
        role === "owner" ? "เจ้าของบริษัท" : "วิศวกร / ผู้บันทึก",
      );
    } else {
      await expect(
        page.getByRole("combobox", { name: "เลือกบริษัท" }),
      ).toHaveValue("");
      await expect(page.locator("#workspace option")).toHaveCount(0);
      await expect(page.locator(".workspace-form")).toBeVisible();
    }
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sb-hvcwskmqwvrjsrysllly-auth-token")!),
    );
    expect(saved.user.id).toBe(userId);
    expect(page.url()).not.toContain(token);
    await page.screenshot({
      path: `output/qa/google-login-${role ?? "new"}.png`,
      fullPage: false,
    });
  });
}

test("Google cancellation and empty callback are recoverable and never follow next", async ({
  page,
}) => {
  await page.goto(
    "/auth/callback?error=access_denied&error_description=DO_NOT_DISPLAY&next=https://evil.example.test",
  );
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "ยกเลิกการเข้าสู่ระบบ",
  );
  await expect(page.locator('.error[role="alert"]')).not.toContainText(
    "DO_NOT_DISPLAY",
  );
  await expect(page).toHaveURL("http://127.0.0.1:3100/auth/callback");
  await page.getByRole("link", { name: "กลับไปเข้าสู่ระบบ" }).click();
  await expect(
    page.getByRole("button", { name: "เข้าสู่ระบบด้วย Google", exact: true }),
  ).toBeVisible();
  await page.goto("/auth/callback?next=//evil.example.test");
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "ไม่พบการเข้าสู่ระบบที่สมบูรณ์",
  );
  await expect(page).toHaveURL("http://127.0.0.1:3100/auth/callback");
});

test("Google callback rejects an invalid token and cleans callback details", async ({
  page,
}) => {
  await page.route("**/auth/v1/user", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "bad_jwt", message: "Invalid token" },
    }),
  );
  await page.goto(
    `/auth/callback#access_token=${token}&refresh_token=test-only&expires_in=3600&token_type=bearer`,
  );
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "ยืนยันการเข้าสู่ระบบไม่สำเร็จ",
  );
  await expect(page).toHaveURL("http://127.0.0.1:3100/auth/callback");
});

test("failed Google callback cannot fall back to an older signed-in account", async ({
  page,
}) => {
  await page.addInitScript(
    ({ user, token }) => {
      localStorage.setItem(
        "sb-hvcwskmqwvrjsrysllly-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "older-session",
          expires_at: 4102444800,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { user, token },
  );
  const badToken = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: "unknown", exp: 4102444800 })}.invalid`;
  await page.route("**/auth/v1/user", (route) => {
    return route.request().headers().authorization === `Bearer ${token}`
      ? route.fulfill({ json: user })
      : route.fulfill({
          status: 401,
          json: { code: "bad_jwt", message: "Invalid token" },
        });
  });
  await page.goto(
    `/auth/callback#access_token=${badToken}&refresh_token=failed&expires_in=3600&token_type=bearer`,
  );
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "ยืนยันการเข้าสู่ระบบไม่สำเร็จ",
  );
  await expect(page).toHaveURL("http://127.0.0.1:3100/auth/callback");
});
