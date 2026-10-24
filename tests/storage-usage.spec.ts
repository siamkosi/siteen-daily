import { test, expect, type Page } from "@playwright/test";
import {
  emptyStorageTotals,
  storageLevel,
  formatStorage,
  parseStorageSummary,
  demoStorageSummary,
  type StorageSummary,
} from "../src/lib/storage-usage";
const workspace = "20000000-0000-4000-8000-000000000001",
  userId = "10000000-0000-4000-8000-000000000001";
const project1 = "30000000-0000-4000-8000-000000000001",
  project2 = "30000000-0000-4000-8000-000000000002";
function summary(
  used = 800_000_000,
  quota: number | null = null,
  unknown = 0,
): StorageSummary {
  const totals = {
    ...emptyStorageTotals(),
    total_bytes: used,
    total_files: 6,
    photo_count: 2,
    report_bytes: used - 180_000_000,
    thumbnail_bytes: 50_000_000,
    cover_bytes: 100_000_000,
    other_bytes: 30_000_000,
    trash_bytes: 550_000_000,
    cancelled_bytes: 150_000_000,
    unknown_files: unknown,
  };
  return {
    workspace_id: workspace,
    quota_bytes: quota,
    warning_percent: 80,
    critical_percent: 95,
    checked_at: "2026-10-24T06:00:00Z",
    totals,
    projects: [
      {
        ...emptyStorageTotals(),
        project_id: project1,
        project_name: "Hampton QA — ข้อมูลสมมติ",
        project_status: "active",
        total_bytes: used - 150_000_000,
        total_files: 3,
        photo_count: 1,
        report_bytes: used - 300_000_000,
        thumbnail_bytes: 50_000_000,
        cover_bytes: 100_000_000,
        trash_bytes: 550_000_000,
      },
      {
        ...emptyStorageTotals(),
        project_id: project2,
        project_name: "โครงการเสร็จแล้ว QA",
        project_status: "completed",
        total_bytes: 150_000_000,
        total_files: 3,
        photo_count: 1,
        report_bytes: 120_000_000,
        other_bytes: 30_000_000,
        cancelled_bytes: 150_000_000,
        unknown_files: unknown,
      },
    ],
  };
}
async function fixture(page: Page, role: "owner" | "editor" | "viewer") {
  const user = {
    id: userId,
    email: "storage@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
  };
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
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
  const state = {
    quota: null as number | null,
    used: 800_000_000,
    unknown: 0,
    fail: false,
    wrongScope: false,
    reads: 0,
    writes: [] as {
      target_workspace: string;
      new_quota_bytes: number | null;
      expected_quota_bytes: number | null;
    }[],
    photoReads: 0,
    storageRequests: 0,
  };
  await page.route("**/auth/v1/user", (r) => r.fulfill({ json: user }));
  await page.route("**/storage/v1/**", (r) => {
    state.storageRequests++;
    return r.fulfill({
      status: 500,
      json: { error: "Summary must not download objects" },
    });
  });
  await page.route("**/rest/v1/**", (r) => {
    const request = r.request(),
      url = new URL(request.url());
    if (url.pathname.endsWith("/memberships"))
      return r.fulfill({
        json: [
          {
            workspace_id: workspace,
            role: role === "owner" ? "owner" : "member",
            workspaces: { id: workspace, name: "Storage QA" },
          },
        ],
      });
    if (url.pathname.endsWith("/projects"))
      return r.fulfill({
        json: [
          {
            id: project1,
            workspace_id: workspace,
            name: "Hampton QA — ข้อมูลสมมติ",
            location: "DEV",
            client: "QA",
            status: "active",
            created_at: "2026-10-24T00:00:00Z",
          },
        ],
      });
    if (url.pathname.endsWith("/rpc/company_photo_storage")) {
      state.reads++;
      expect(request.postDataJSON()).toEqual({ target_workspace: workspace });
      if (state.fail)
        return r.fulfill({
          status: 500,
          json: { message: "storage unavailable" },
        });
      const data = summary(state.used, state.quota, state.unknown);
      if (state.wrongScope) data.workspace_id = "wrong-company";
      return r.fulfill({ json: data });
    }
    if (url.pathname.endsWith("/rpc/set_company_photo_quota")) {
      expect(role).toBe("owner");
      const body = request.postDataJSON();
      state.writes.push(body);
      expect(body.target_workspace).toBe(workspace);
      if (body.expected_quota_bytes !== state.quota)
        return r.fulfill({
          status: 409,
          json: { code: "40001", message: "quota changed" },
        });
      state.quota = body.new_quota_bytes;
      return r.fulfill({ status: 204, body: "" });
    }
    if (url.pathname.endsWith("/photos")) state.photoReads++;
    return r.fulfill({ json: [] });
  });
  return state;
}

test("storage threshold boundaries, units, null quota, unknown sizes and demo retained bytes", () => {
  for (const [used, expected] of [
    [799999999, "ok"],
    [800000000, "warning"],
    [949999999, "warning"],
    [950000000, "critical"],
    [999999999, "critical"],
    [1000000000, "full"],
    [1200000000, "full"],
  ] as const)
    expect(storageLevel(summary(used, 1_000_000_000))).toBe(expected);
  expect(storageLevel(summary(1_200_000_000, null))).toBe("unset");
  expect(formatStorage(1_000_000_000)).toBe("1 GB");
  expect(() => parseStorageSummary(summary(), "other-workspace")).toThrow();
  expect(() =>
    parseStorageSummary(
      { ...summary(), totals: { ...summary().totals, total_bytes: NaN } },
      workspace,
    ),
  ).toThrow();
  const demo = demoStorageSummary(
    {
      projects: [
        {
          id: project1,
          workspace_id: workspace,
          name: "demo",
          location: "",
          client: "",
          status: "active",
          created_at: "",
        },
      ],
      reports: [{ id: "r", deleted_at: "2026-10-24T00:00:00Z" } as never],
      photos: [
        {
          id: "p",
          workspace_id: workspace,
          project_id: project1,
          report_id: "r",
          path: "p",
          caption: "",
          url: "data:image/jpeg;base64,YWJj",
          thumbnail_url: "data:image/jpeg;base64,YQ==",
        },
      ],
    },
    workspace,
  );
  expect(demo.totals.total_bytes).toBe(4);
  expect(demo.totals.trash_bytes).toBe(4);
  expect(demo.totals.photo_count).toBe(1);
  expect(demo.totals.total_files).toBe(2);
});

for (const role of ["owner", "editor", "viewer"] as const)
  test(`storage usage and quota permissions as ${role}`, async ({ page }) => {
    const state = await fixture(page, role);
    await page.goto("/storage");
    if (role !== "owner") {
      await expect(
        page.getByText("เฉพาะ Owner ที่ดูพื้นที่รวมของบริษัทได้"),
      ).toBeVisible();
      expect(state.reads).toBe(0);
      expect(state.writes).toHaveLength(0);
      return;
    }
    await expect(
      page.getByRole("heading", { name: "พื้นที่จัดเก็บรูป", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".storage-summary-cards article")).toHaveCount(4);
    await expect(
      page.locator(".storage-summary-cards article").first(),
    ).toContainText("800 MB");
    await expect(
      page.locator(".storage-summary-cards article").nth(1),
    ).toContainText("ยังไม่กำหนด");
    await expect(page.locator(".storage-breakdown")).toContainText(
      "โครงการเสร็จแล้ว QA",
    );
    await expect(page.locator(".storage-breakdown")).toContainText("550 MB");
    expect(state.photoReads).toBe(0);
    expect(state.storageRequests).toBe(0);
    if (role !== "owner") {
      await expect(
        page.getByLabel("โควตารูปของบริษัท (GB)", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "บันทึกโควตาแจ้งเตือน", exact: true }),
      ).toHaveCount(0);
      expect(state.writes).toHaveLength(0);
      return;
    }
    await page.getByLabel("โควตารูปของบริษัท (GB)", { exact: true }).fill("1");
    await page
      .getByRole("button", { name: "บันทึกโควตาแจ้งเตือน", exact: true })
      .click();
    await expect(page.locator(".storage-notice.storage-warning")).toContainText(
      "80.0%",
    );
    expect(state.writes[0]).toEqual({
      target_workspace: workspace,
      new_quota_bytes: 1_000_000_000,
      expected_quota_bytes: null,
    });
    await page.getByRole("link", { name: "ภาพรวม", exact: true }).click();
    await expect(page.locator(".storage-notice.storage-warning")).toContainText(
      "พื้นที่รูปใกล้เต็ม",
    );
    await page
      .getByRole("link", { name: "ดูพื้นที่แยกตามโครงการ", exact: true })
      .click();
    state.used = 950_000_000;
    await page
      .getByRole("button", { name: "อัปเดตพื้นที่ล่าสุด", exact: true })
      .click();
    await expect(page.locator(".storage-critical").first()).toContainText(
      "95.0%",
    );
    state.used = 1_200_000_000;
    await page
      .getByRole("button", { name: "อัปเดตพื้นที่ล่าสุด", exact: true })
      .click();
    await expect(page.locator(".storage-notice.storage-full")).toContainText(
      "120.0%",
    );
    await expect(
      page.locator(".storage-summary-cards article").nth(2),
    ).toContainText("0 B");
    await page.screenshot({
      path: "output/qa/storage-quota-full.png",
      fullPage: false,
    });
    await page.getByLabel("โควตารูปของบริษัท (GB)", { exact: true }).fill("");
    await page
      .getByRole("button", { name: "บันทึกโควตาแจ้งเตือน", exact: true })
      .click();
    await expect(
      page.locator(".storage-summary-cards article").nth(1),
    ).toContainText("ยังไม่กำหนด");
    await expect(page.locator(".storage-notice.storage-full")).toHaveCount(0);
    expect(state.quota).toBeNull();
  });

test("storage errors are not reported as zero usage; unknown sizes and wrong company are explicit", async ({
  page,
}) => {
  const state = await fixture(page, "owner");
  state.fail = true;
  await page.goto("/storage");
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "ตรวจพื้นที่จัดเก็บไม่สำเร็จ",
  );
  await expect(page.locator(".storage-summary-cards")).toHaveCount(0);
  state.fail = false;
  state.unknown = 1;
  await page
    .getByRole("button", { name: "ลองตรวจพื้นที่ใหม่", exact: true })
    .click();
  await expect(page.locator(".storage-summary-cards")).toBeVisible();
  await expect(page.locator(".storage-notice")).toContainText(
    "ยอดพื้นที่อาจสูงกว่าที่แสดง",
  );
  await expect(
    page.locator(".storage-summary-cards article").first(),
  ).toContainText("อย่างน้อย");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/qa/storage-mobile.png",
    fullPage: false,
  });
  state.wrongScope = true;
  await page
    .getByRole("button", { name: "อัปเดตพื้นที่ล่าสุด", exact: true })
    .click();
  await expect(page.locator('.error[role="alert"]')).toBeVisible();
  await expect(page.locator(".storage-summary-cards")).toHaveCount(0);
});

test("owner draft preserves expected-null quota across refresh and rejects concurrent edits", async ({
  page,
}) => {
  const state = await fixture(page, "owner");
  await page.goto("/storage");
  await page.getByLabel("โควตารูปของบริษัท (GB)", { exact: true }).fill("2");
  state.quota = 1_000_000_000;
  await page
    .getByRole("button", { name: "อัปเดตพื้นที่ล่าสุด", exact: true })
    .click();
  await expect(
    page.locator(".storage-summary-cards article").nth(1),
  ).toContainText("1 GB");
  await expect(
    page.getByLabel("โควตารูปของบริษัท (GB)", { exact: true }),
  ).toHaveValue("2");
  await page
    .getByRole("button", { name: "บันทึกโควตาแจ้งเตือน", exact: true })
    .click();
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "โควตาถูกเปลี่ยนโดยผู้อื่น",
  );
  expect(state.writes[0].expected_quota_bytes).toBeNull();
  expect(state.quota).toBe(1_000_000_000);
  await page
    .getByRole("button", { name: "โหลดค่าโควตาล่าสุด", exact: true })
    .click();
  await expect(
    page.getByLabel("โควตารูปของบริษัท (GB)", { exact: true }),
  ).toHaveValue("1");
  await page.getByLabel("โควตารูปของบริษัท (GB)", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "บันทึกโควตาแจ้งเตือน", exact: true })
    .click();
  await expect(
    page.locator(".storage-summary-cards article").nth(1),
  ).toContainText("2 GB");
  expect(state.quota).toBe(2_000_000_000);
});
