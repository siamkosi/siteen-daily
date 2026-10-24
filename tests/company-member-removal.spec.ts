import { test, expect, type Page } from "@playwright/test";
import { companyFixture, wid, pid, mid, uid, iid } from "./company-fixture";
const version = "60000000-0000-4000-8000-000000000001",
  hash = "a".repeat(32);
test("Roster and assignments use one membership snapshot after rejoin", async ({
  page,
}) => {
  await companyFixture(page);
  let separateAssignmentReads = 0;
  await page.route("**/rest/v1/rpc/list_project_assignments", (r) => {
    separateAssignmentReads++;
    return r.fulfill({
      json: [{ user_id: mid, project_id: pid, role: "editor", row_version: 1 }],
    });
  });
  await page.route("**/rest/v1/rpc/list_company_members_with_revisions", (r) =>
    r.fulfill({
      json: [
        {
          user_id: uid,
          email: "owner@example.test",
          role: "owner",
          membership_version: version,
          assignments: [],
        },
        {
          user_id: mid,
          email: "engineer@example.test",
          role: "member",
          membership_version: "60000000-0000-4000-8000-000000000002",
          assignments: [
            { user_id: mid, project_id: pid, role: "viewer", row_version: 1 },
          ],
        },
      ],
    }),
  );
  await page.goto("/settings");
  await expect(
    page.getByRole("combobox", {
      name: "สิทธิ์ engineer@example.test — Hampton",
      exact: true,
    }),
  ).toHaveValue("viewer");
  expect(separateAssignmentReads).toBe(0);
  await page
    .getByRole("combobox", {
      name: "สิทธิ์ engineer@example.test — Hampton",
      exact: true,
    })
    .selectOption("editor");
  await page
    .getByRole("button", { name: "ยืนยันเปลี่ยนสิทธิ์", exact: true })
    .click();
  await expect(
    page.getByText("บันทึกสิทธิ์โครงการแล้ว", { exact: true }),
  ).toBeVisible();
});
async function removalFixture(page: Page, role: "owner" | "member" = "owner") {
  await companyFixture(page, role);
  const state = {
    removed: false,
    previews: 0,
    removes: 0,
    mode: "ok",
    hash,
    version,
  };
  await page.route("**/rest/v1/rpc/list_company_members_with_revisions", (r) =>
    r.fulfill({
      json: [
        {
          user_id: uid,
          email: "owner@example.test",
          role: "owner",
          membership_version: version,
          assignments: [],
        },
        ...(state.removed
          ? []
          : [
              {
                user_id: mid,
                email: "engineer@example.test",
                role: "member",
                membership_version: state.version,
                assignments: [
                  {
                    user_id: mid,
                    project_id: pid,
                    role: "editor",
                    row_version: 1,
                  },
                ],
              },
            ]),
      ],
    }),
  );
  await page.route("**/rest/v1/rpc/preview_company_member_removal", (r) => {
    expect(r.request().postDataJSON()).toEqual({
      target_workspace: wid,
      target_user: mid,
    });
    state.previews++;
    return r.fulfill({
      json: {
        workspace_id: wid,
        company_name: "27 วิศวกรรม",
        user_id: mid,
        email: "engineer@example.test",
        membership_version: state.version,
        assignments_hash: state.hash,
        projects: [{ id: pid, name: "Hampton", role: "editor" }],
      },
    });
  });
  await page.route("**/rest/v1/rpc/remove_company_member", (r) => {
    expect(r.request().postDataJSON()).toEqual({
      target_workspace: wid,
      target_user: mid,
      expected_membership_version: state.version,
      expected_assignments_hash: state.hash,
    });
    state.removes++;
    if (state.mode === "stale")
      return r.fulfill({
        status: 409,
        json: { code: "40001", message: "Changed membership" },
      });
    state.removed = true;
    if (state.mode === "unknown") return r.abort("failed");
    return r.fulfill({ status: 204, body: "" });
  });
  await page.route("**/rest/v1/rpc/list_company_access_events", (r) =>
    r.fulfill({
      json: {
        items: state.removed
          ? [
              {
                id: iid,
                action: "company_member_removed",
                actor_id: uid,
                created_at: "2026-10-24T00:00:00Z",
                details: {
                  user_id: mid,
                  email: "engineer@example.test",
                  project_ids: [pid],
                },
              },
            ]
          : [],
        next_cursor: null,
      },
    }),
  );
  return state;
}
test("Owner reviews member/company/project and can cancel without a removal", async ({
  page,
}) => {
  const state = await removalFixture(page);
  await page.goto("/settings");
  await page
    .getByRole("button", {
      name: "นำ engineer@example.test ออกจากบริษัท",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("region", {
    name: "ยืนยันนำสมาชิกออก",
    exact: true,
  });
  await expect(dialog).toContainText("27 วิศวกรรม");
  await expect(dialog).toContainText("engineer@example.test");
  await expect(dialog).toContainText("Hampton");
  await expect(dialog).toContainText("รายงาน รูป และประวัติเดิมยังอยู่");
  expect(state.previews).toBe(1);
  expect(state.removes).toBe(0);
  await page
    .getByRole("button", { name: "ยกเลิกการนำออก", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.removes).toBe(0);
  await expect(
    page.getByRole("button", {
      name: "นำ owner@example.test ออกจากบริษัท",
      exact: true,
    }),
  ).toHaveCount(0);
});
test("Confirmed removal refreshes roster and retained-history audit on desktop/mobile", async ({
  page,
}) => {
  const state = await removalFixture(page);
  await page.goto("/settings");
  await page
    .getByRole("button", {
      name: "นำ engineer@example.test ออกจากบริษัท",
      exact: true,
    })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/qa/member-removal-confirm-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "ยืนยันนำสมาชิกออก", exact: true })
    .click();
  await expect(
    page.getByText(
      "นำ engineer@example.test ออกจากบริษัทแล้ว รายงาน รูป และประวัติเดิมยังอยู่",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "นำ engineer@example.test ออกจากบริษัท",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText("นำสมาชิกออกจากบริษัท", { exact: true }),
  ).toBeVisible();
  expect(state.removes).toBe(1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: "test-results/qa/member-removal-retained-audit.png",
    fullPage: true,
  });
});
test("Changed membership requires reload and a new explicit confirmation", async ({
  page,
}) => {
  const state = await removalFixture(page);
  state.mode = "stale";
  await page.goto("/settings");
  await page
    .getByRole("button", {
      name: "นำ engineer@example.test ออกจากบริษัท",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "ยืนยันนำสมาชิกออก", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "จัดการสมาชิก — 27 วิศวกรรม", exact: true })
      .getByRole("alert"),
  ).toContainText("สมาชิกหรือสิทธิ์โครงการเปลี่ยนแล้ว");
  expect(state.removed).toBe(false);
  await expect(
    page.getByRole("region", { name: "ยืนยันนำสมาชิกออก", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "โหลดรายชื่อใหม่", exact: true })
    .click();
  state.mode = "ok";
  state.hash = "b".repeat(32);
  state.version = "60000000-0000-4000-8000-000000000002";
  await page
    .getByRole("button", {
      name: "นำ engineer@example.test ออกจากบริษัท",
      exact: true,
    })
    .click();
  expect(state.previews).toBe(2);
  await page
    .getByRole("button", { name: "ยืนยันนำสมาชิกออก", exact: true })
    .click();
  await expect.poll(() => state.removed).toBe(true);
});
test("Unknown transport outcome does not automatically repeat removal", async ({
  page,
}) => {
  const state = await removalFixture(page);
  state.mode = "unknown";
  await page.goto("/settings");
  await page
    .getByRole("button", {
      name: "นำ engineer@example.test ออกจากบริษัท",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "ยืนยันนำสมาชิกออก", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "จัดการสมาชิก — 27 วิศวกรรม", exact: true })
      .getByRole("alert"),
  ).toContainText("ยังยืนยันผลการนำออกไม่ได้");
  expect(state.removes).toBe(1);
  await page
    .getByRole("button", { name: "โหลดรายชื่อใหม่", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "นำ engineer@example.test ออกจากบริษัท",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(state.removes).toBe(1);
});
test("Company member has no removal controls or preview request", async ({
  page,
}) => {
  const state = await removalFixture(page, "member");
  await page.goto("/settings");
  await expect(
    page.getByText("เฉพาะ Owner ที่เข้าถึงบริษัทและการตั้งค่าได้"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /นำ .* ออกจากบริษัท/ }),
  ).toHaveCount(0);
  expect(state.previews).toBe(0);
  expect(state.removes).toBe(0);
});
