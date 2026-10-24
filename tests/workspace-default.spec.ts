import { test, expect } from "@playwright/test";

const userId = "f0eed677-bb05-4863-9b9a-30164206b61f";
const target = "dcf175be-9fe4-49cb-a4e5-f2fdf88a41d5";
const other = "20000000-0000-4000-8000-000000000002";

for (const hasTarget of [true, false]) {
  test(`account default company; membership available=${hasTarget}`, async ({
    page,
  }) => {
    let loginTime = "2026-10-24T02:00:00Z";
    const user = {
      id: userId,
      email: "siamkosi@gmail.com",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: loginTime,
      last_sign_in_at: loginTime,
    };
    const part = (x: unknown) =>
      Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: userId, exp: 4102444800, role: "authenticated" })}.signature`;
    await page.addInitScript(
      ({ user, token, other }) => {
        if (!localStorage.getItem("default-test-initialized")) {
          localStorage.setItem("default-test-initialized", "true");
          localStorage.setItem(
            "sb-hvcwskmqwvrjsrysllly-auth-token",
            JSON.stringify({
              access_token: token,
              refresh_token: "test-only",
              token_type: "bearer",
              expires_in: 3600,
              expires_at: 4102444800,
              user,
            }),
          );
          sessionStorage.setItem(`site-daily-workspace:${user.id}`, other);
          sessionStorage.setItem(
            `site-daily-workspace-login:${user.id}`,
            "previous-login",
          );
        }
      },
      { user, token, other },
    );
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({ json: { ...user, last_sign_in_at: loginTime } }),
    );
    await page.route("**/auth/v1/logout**", route => route.fulfill({status:204,body:""}));
    await page.route("**/auth/v1/token**", route => route.fulfill({json:{access_token:token,refresh_token:"test-only",token_type:"bearer",expires_in:3600,expires_at:4102444800,user:{...user,last_sign_in_at:loginTime}}}));
    await page.route("**/rest/v1/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/memberships"))
        return route.fulfill({
          json: [
            {
              workspace_id: other,
              role: "owner",
              workspaces: { id: other, name: "บริษัททดสอบ" },
            },
            ...(hasTarget
              ? [
                  {
                    workspace_id: target,
                    role: "owner",
                    workspaces: { id: target, name: "27 วิศวกรรม" },
                  },
                ]
              : []),
          ],
        });
      return route.fulfill({ json: [] });
    });
    await page.goto("/dashboard");
    const selector = page.getByRole("combobox", { name: "เลือกบริษัท" });
    await expect(selector).toHaveValue(hasTarget ? target : other);
    if (!hasTarget) return;
    await selector.selectOption(other);
    await page.getByRole("link", { name: "โครงการ", exact: true }).click();
    await expect(selector).toHaveValue(other);
    await page.reload();
    await expect(selector).toHaveValue(other);
    // A new password login resets selection even after using the test company.
    await page.getByRole("button",{name:"ออกจากระบบ",exact:true}).click();
    await expect(page.getByRole("heading",{name:"เข้าสู่ระบบ",exact:true})).toBeVisible();
    loginTime = "2026-10-24T03:00:00Z";
    await page.getByLabel("อีเมล",{exact:true}).fill("siamkosi@gmail.com");
    await page.getByLabel("รหัสผ่าน",{exact:true}).fill("test-only-password");
    await page.getByRole("button",{name:"เข้าสู่ระบบ",exact:true}).click();
    await expect(selector).toHaveValue(target);
  });
}
