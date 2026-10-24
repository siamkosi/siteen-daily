import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

for (const role of ["editor", "viewer"] as const)
  test(`private project covers as ${role}: signed reads and upload rollback`, async ({
    page,
  }) => {
    const userId = "10000000-0000-4000-8000-000000000001",
      workspace = "20000000-0000-4000-8000-000000000001",
      project = "30000000-0000-4000-8000-000000000001";
    const user = {
      id: userId,
      email: "cover@example.test",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-10-24T00:00:00Z",
    };
    const part = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString("base64url");
    const token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: userId, exp: 4102444800, role: "authenticated" })}.signature`;
    await page.addInitScript(
      ({ user, token }) =>
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
        ),
      { user, token },
    );
    const oldPath = `${workspace}/${project}/40000000-0000-4000-8000-000000000001.png`;
    let currentPath: string | null = oldPath,
      failUpdate = true,
      writes = 0;
    const uploaded: string[] = [],
      removed: string[] = [];
    const jpeg = readFileSync("public/report-logos/27-engineering.jpg");
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({ json: user }),
    );
    await page.route("**/rest/v1/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/memberships"))
        return route.fulfill({
          json: [
            {
              workspace_id: workspace,
              role,
              workspaces: { id: workspace, name: "Cover QA" },
            },
          ],
        });
      if (url.pathname.endsWith("/projects")) {
        if (route.request().method() === "PATCH") {
          expect(role).toBe("editor");
          writes++;
          const payload = route.request().postDataJSON();
          expect(Object.keys(payload)).toEqual(["cover_path"]);
          expect(url.searchParams.get("workspace_id")).toBe(`eq.${workspace}`);
          expect(url.searchParams.get("id")).toBe(`eq.${project}`);
          if (failUpdate) {
            failUpdate = false;
            return route.fulfill({
              status: 500,
              json: { message: "ทดสอบบันทึกล้มเหลว" },
            });
          }
          currentPath = payload.cover_path;
          return route.fulfill({ json: { id: project } });
        }
        return route.fulfill({
          json: [
            {
              id: project,
              workspace_id: workspace,
              name: "Hampton Cover QA",
              location: "DEV",
              client: "QA",
              status: "active",
              created_at: "2026-10-24T00:00:00Z",
              cover_path: currentPath,
            },
          ],
        });
      }
      return route.fulfill({ json: [] });
    });
    await page.route("**/storage/v1/**", (route) => {
      const url = new URL(route.request().url()),
        method = route.request().method();
      if (
        url.pathname.includes("/object/sign/project-covers/") &&
        method === "POST"
      )
        return route.fulfill({
          json: {
            signedURL: url.pathname.replace("/storage/v1", "") + "?token=qa",
          },
        });
      if (method === "GET")
        return route.fulfill({ body: jpeg, contentType: "image/jpeg" });
      expect(role).toBe("editor");
      if (method === "DELETE") {
        removed.push(...route.request().postDataJSON().prefixes);
        return route.fulfill({ json: [] });
      }
      if (method === "POST") {
        const path = decodeURIComponent(
          url.pathname.split("/object/project-covers/")[1],
        );
        expect(path).toMatch(
          new RegExp(`^${workspace}/${project}/[0-9a-f-]{36}\\.jpeg$`),
        );
        uploaded.push(path);
        return route.fulfill({ json: { Key: `project-covers/${path}` } });
      }
      throw new Error("Unexpected storage operation");
    });
    await page.goto("/projects");
    await expect(page.locator(".project-cover-photo")).toBeVisible();
    if (role === "viewer") {
      await expect(
        page.getByRole("button", { name: /ตั้งค่ารูปโครงการ/ }),
      ).toHaveCount(0);
      expect(writes).toBe(0);
      return;
    }
    await page.getByRole("button", { name: /ตั้งค่ารูปโครงการ/ }).click();
    await page.getByLabel("รูปโครงการ", { exact: true }).setInputFiles({
      name: "cover.jpg",
      mimeType: "image/jpeg",
      buffer: jpeg,
    });
    await page
      .getByRole("button", { name: "บันทึกรูปโครงการ", exact: true })
      .click();
    await expect(page.locator('.error[role="alert"]')).toContainText(
      "บันทึกรูปโครงการไม่สำเร็จ",
    );
    expect(currentPath).toBe(oldPath);
    expect(removed).toEqual([uploaded[0]]);
    await page
      .getByRole("button", { name: "บันทึกรูปโครงการ", exact: true })
      .click();
    await expect(page.locator(".project-cover-editor")).toHaveCount(0);
    expect(uploaded).toHaveLength(2);
    expect(currentPath).toBe(uploaded[1]);
    expect(removed).toEqual([uploaded[0], oldPath]);
    await page.reload();
    await expect(page.locator(".project-cover-photo")).toHaveAttribute(
      "src",
      new RegExp(uploaded[1]),
    );
  });

test("project cover upload, validation, persistence, cancellation and removal", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" })
    .click();
  await expect(
    page.getByRole("heading", { name: "ภาพรวมหน้างาน", exact: true }),
  ).toBeVisible();
  const png = await page.locator(".project-cover").first().screenshot();
  await page.getByRole("link", { name: "โครงการ", exact: true }).click();
  const settings = page
    .getByRole("button", { name: /ตั้งค่ารูปโครงการ/ })
    .first();
  await settings.click();
  const input = page.getByLabel("รูปโครงการ", { exact: true });
  await input.setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "JPG, PNG หรือ WebP",
  );
  await input.setInputFiles({
    name: "corrupt.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid image"),
  });
  await page
    .getByRole("button", { name: "บันทึกรูปโครงการ", exact: true })
    .click();
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "ไฟล์รูปภาพนี้เปิดไม่ได้",
  );
  await input.setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.locator('.error[role="alert"]')).toContainText("5 MB");
  await input.setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.locator(".project-cover-preview")).toBeVisible();
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(page.locator(".project-cover-photo")).toHaveCount(0);
  await settings.click();
  await input.setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page
    .getByRole("button", { name: "บันทึกรูปโครงการ", exact: true })
    .click();
  await expect(page.locator(".project-cover-photo")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".project-cover-photo")).toHaveCount(1);
  await page.getByRole("link", { name: "ภาพรวม", exact: true }).click();
  await expect(page.locator(".project-cover-photo")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ไปที่ Daily Request", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/qa/project-cover-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "โครงการ", exact: true }).click();
  await settings.click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/qa/project-cover-mobile.png",
    fullPage: true,
  });
  await input.setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByLabel("นำรูปโครงการออก ใช้ภาพเริ่มต้น").check();
  await page.getByLabel("นำรูปโครงการออก ใช้ภาพเริ่มต้น").uncheck();
  await expect(page.locator(".project-cover-preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "บันทึกรูปโครงการ", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("นำรูปโครงการออก ใช้ภาพเริ่มต้น").check();
  await page
    .getByRole("button", { name: "บันทึกรูปโครงการ", exact: true })
    .click();
  await expect(page.locator(".project-cover-photo")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".project-cover-photo")).toHaveCount(0);
});
