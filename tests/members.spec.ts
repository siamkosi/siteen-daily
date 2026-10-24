import { test, expect } from "@playwright/test";

const userId = "10000000-0000-4000-8000-000000000001";
const workspace = "20000000-0000-4000-8000-000000000001";
const editorId = "10000000-0000-4000-8000-000000000002";

for (const role of ["owner", "editor", "viewer"] as const) {
  test(`company member management as ${role}`, async ({ page }) => {
    let memberRole = "editor";
    let writes = 0;
    const user = {
      id: userId,
      email: "owner@example.test",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-10-24T00:00:00Z",
    };
    const tokenPart = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${tokenPart({ alg: "HS256", typ: "JWT" })}.${tokenPart({ sub: userId, exp: 4102444800, role: "authenticated" })}.signature`;
    await page.addInitScript(
      ({ user, token }) => {
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
      },
      { user, token },
    );
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({ json: user }),
    );
    await page.route("**/rest/v1/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/memberships"))
        return route.fulfill({
          json: [
            {
              workspace_id: workspace,
              role,
              workspaces: { id: workspace, name: "27 วิศวกรรม" },
            },
          ],
        });
      if (url.pathname.endsWith("/rpc/list_company_members")) {
        expect(role).toBe("owner");
        return route.fulfill({
          json: [
            { user_id: userId, email: user.email, role: "owner" },
            {
              user_id: editorId,
              email: "editor@example.test",
              role: memberRole,
            },
          ],
        });
      }
      if (url.pathname.endsWith("/rpc/set_company_member_role")) {
        expect(role).toBe("owner");
        const payload = route.request().postDataJSON();
        expect(payload).toEqual({
          target_workspace: workspace,
          target_user: editorId,
          new_role: memberRole === "editor" ? "viewer" : "editor",
          expected_role: memberRole,
        });
        memberRole = payload.new_role;
        writes++;
        return route.fulfill({ status: 204, body: "" });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/settings");
    if (role !== "owner") {
      await expect(
        page.getByText(
          "เฉพาะ owner ของบริษัทนี้ที่ดูรายชื่อและจัดการบทบาทสมาชิกได้",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "จัดการสมาชิก — 27 วิศวกรรม" }),
      ).toHaveCount(0);
      expect(writes).toBe(0);
      return;
    }
    await expect(
      page.getByRole("heading", { name: "จัดการสมาชิก — 27 วิศวกรรม" }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "เปลี่ยน editor@example.test เป็น viewer",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "ยกเลิกการเปลี่ยนบทบาท", exact: true })
      .click();
    expect(writes).toBe(0);
    await page
      .getByRole("button", {
        name: "เปลี่ยน editor@example.test เป็น viewer",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "ยืนยันเปลี่ยนบทบาท", exact: true })
      .click();
    await expect(
      page.getByText("บันทึกแล้ว: editor@example.test เป็น viewer", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "เปลี่ยน editor@example.test เป็น editor",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "ยืนยันเปลี่ยนบทบาท", exact: true })
      .click();
    await expect(
      page.getByText("บันทึกแล้ว: editor@example.test เป็น editor", {
        exact: true,
      }),
    ).toBeVisible();
    expect(writes).toBe(2);
    await page.screenshot({
      path: "test-results/qa/company-members-owner.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("heading", { name: "จัดการสมาชิก — 27 วิศวกรรม" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/qa/company-members-mobile.png",
      fullPage: true,
    });
  });
}
