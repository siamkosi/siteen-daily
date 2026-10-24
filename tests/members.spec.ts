import { test, expect } from "@playwright/test";
import { companyFixture } from "./company-fixture";
test("Owner assigns project roles and revokes access", async ({ page }) => {
  const state = await companyFixture(page);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "จัดการสมาชิก — 27 วิศวกรรม" }),
  ).toBeVisible();
  const select = page.getByLabel("สิทธิ์ engineer@example.test — Hampton");
  await select.selectOption("viewer");
  await page.getByRole("button", { name: "ยืนยันเปลี่ยนสิทธิ์" }).click();
  await expect(select).toHaveValue("viewer");
  await select.selectOption("");
  await page.getByRole("button", { name: "ยืนยันเปลี่ยนสิทธิ์" }).click();
  await expect(select).toHaveValue("");
  expect(state.writes).toBe(2);
  await page.screenshot({
    path: "test-results/qa/company-members-owner.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Owner reviews invitation before send and can resend/cancel", async ({
  page,
}) => {
  const state = await companyFixture(page);
  await page.goto("/settings");
  await page.getByLabel("อีเมลผู้รับคำเชิญ").fill("new@example.test");
  await page.getByLabel("เชิญเข้าโครงการ Hampton").check();
  await page.getByRole("button", { name: "ตรวจคำเชิญ" }).click();
  expect(state.sends).toBe(0);
  await expect(
    page.getByRole("region", { name: "ตรวจคำเชิญก่อนส่ง" }),
  ).toContainText("new@example.test");
  await page.getByRole("button", { name: "ยืนยันส่งคำเชิญ" }).click();
  await expect(
    page.getByText("ส่งอีเมลแล้ว กรุณาให้ผู้รับยืนยันและยอมรับคำเชิญ"),
  ).toBeVisible();
  expect(state.sends).toBe(1);
  await page.getByRole("button", { name: "ส่งคำเชิญซ้ำ" }).click();
  await page.getByRole("button", { name: "ยืนยันส่งคำเชิญ" }).click();
  await expect.poll(() => state.sends).toBe(2);
  await page.getByRole("button", { name: "ยกเลิกคำเชิญ" }).click();
  await page.getByRole("button", { name: "ยืนยันยกเลิกคำเชิญ" }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
});
test("Member has no Owner controls or global storage request", async ({
  page,
}) => {
  await companyFixture(page, "member");
  let storageCalls = 0;
  page.on("request", (r) => {
    if (r.url().includes("rpc/company_photo_storage")) storageCalls++;
  });
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "จัดการสมาชิก — 27 วิศวกรรม" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("อีเมลผู้รับคำเชิญ")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "พื้นที่จัดเก็บรูป", exact: true }),
  ).toHaveCount(0);
  expect(storageCalls).toBe(0);
});
test("Recipient without company explicitly accepts and opens project", async ({
  page,
}) => {
  const state = await companyFixture(page, "none");
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "คำเชิญเข้าบริษัท" }),
  ).toBeVisible();
  expect(state.accepted).toBe(false);
  await page.getByRole("button", { name: "ยอมรับคำเชิญ" }).click();
  await expect(page.getByRole("heading", { name: "Hampton" })).toBeVisible();
  expect(state.accepted).toBe(true);
});

import { pid, wid, uid } from "./company-fixture";
const second = "30000000-0000-4000-8000-000000000002",
  rid = "50000000-0000-4000-8000-000000000001";
test("Project Editor and Viewer roles differ; focus revocation clears open data", async ({
  page,
}) => {
  const state = await companyFixture(page, "member");
  let revoked = false;
  const projects = [
    {
      id: pid,
      workspace_id: wid,
      name: "Hampton",
      location: "DEV",
      status: "active",
      client: "QA",
      created_at: "2026-10-23T00:00:00Z",
    },
    {
      id: second,
      workspace_id: wid,
      name: "Second project",
      location: "DEV",
      status: "active",
      client: "QA",
      created_at: "2026-10-23T00:00:00Z",
    },
  ];
  const reports = projects.map((p, i) => ({
    id: i ? "50000000-0000-4000-8000-000000000002" : rid,
    workspace_id: wid,
    project_id: p.id,
    report_date: "2026-10-23",
    weather: "ยังไม่บันทึก",
    workers: 0,
    work_done: "Original",
    materials: "",
    equipment: "",
    issues: "",
    tomorrow: "",
    status: "draft",
    created_by: uid,
    created_at: "2026-10-23T00:00:00Z",
    updated_at: "2026-10-23T00:00:00Z",
    row_version: 1,
  }));
  await page.route("**/rest/v1/projects?**", (r) =>
    r.fulfill({ json: revoked ? projects.slice(1) : projects }),
  );
  await page.route("**/rest/v1/project_memberships?**", (r) =>
    r.fulfill({
      json: [
        ...(revoked
          ? []
          : [
              {
                workspace_id: wid,
                user_id: uid,
                project_id: pid,
                role: "editor",
                row_version: 1,
              },
            ]),
        {
          workspace_id: wid,
          user_id: uid,
          project_id: second,
          role: "viewer",
          row_version: 1,
        },
      ],
    }),
  );
  await page.route("**/rest/v1/daily_reports?**", (r) =>
    r.fulfill({ json: revoked ? reports.slice(1) : reports }),
  );
  await page.goto("/projects");
  await expect(
    page.getByRole("button", { name: "สร้างโครงการ", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "ตั้งค่ารูปโครงการ — Hampton" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ตั้งค่ารูปโครงการ — Second project" }),
  ).toHaveCount(0);
  await page.goto("/requests");
  await expect(
    page.getByRole("link", { name: "สร้างจาก Daily Report ล่าสุด — Hampton" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "สร้างจาก Daily Report ล่าสุด — Second project",
    }),
  ).toHaveCount(0);
  await page.goto(`/reports/${reports[1].id}`);
  await expect(
    page.getByRole("button", { name: "แก้ไข", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/reports/${rid}`);
  await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
  const field = page.getByLabel("รายละเอียดงาน 1", { exact: true });
  await field.fill("Unsaved plan");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(field).toHaveValue("Unsaved plan");
  revoked = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText("ไม่พบรายงาน หรือไม่มีสิทธิ์เข้าถึง", { exact: true }),
  ).toBeVisible();
  await expect(field).toHaveCount(0);
  expect(state.writes).toBe(0);
});
test("Wrong account acceptance shows error and grants no membership", async ({
  page,
}) => {
  const state = await companyFixture(page, "none");
  await page.route("**/rest/v1/rpc/accept_company_invitation", (r) =>
    r.fulfill({
      status: 403,
      json: { code: "42501", message: "Verified email mismatch" },
    }),
  );
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "ยอมรับคำเชิญ" }).click();
  await expect(
    page.locator('[aria-label="คำเชิญของฉัน"] [role="alert"]'),
  ).toContainText("อีเมล");
  expect(state.accepted).toBe(false);
  await expect(page.locator("#workspace option")).toHaveCount(0);
});
