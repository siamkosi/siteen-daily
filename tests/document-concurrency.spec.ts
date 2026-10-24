import { test, expect, type Page } from "@playwright/test";
import type { Report } from "../src/lib/types";

const workspace = "20000000-0000-4000-8000-000000000001";
const project = "30000000-0000-4000-8000-000000000001";
const document = "40000000-0000-4000-8000-000000000001";

function original(): Report {
  return {
    id: document,
    workspace_id: workspace,
    project_id: project,
    report_date: "2026-10-23",
    weather: "ยังไม่บันทึก",
    workers: 0,
    work_done: "Original — ข้อมูลสมมติ",
    materials: "",
    equipment: "",
    issues: "",
    tomorrow: "",
    status: "draft",
    row_version: 1,
    created_by: "10000000-0000-4000-8000-000000000001",
    created_at: "2026-10-23T00:00:00Z",
    updated_at: "2026-10-23T00:00:00Z",
    report_details: {
      version: 1,
      meta: {},
      labor: [],
      equipment: [],
      progress: [
        {
          description: "Original — ข้อมูลสมมติ",
          time: "08:00–17:00",
          quantity: null,
          unit: "",
        },
      ],
    },
  };
}

// Two independent auth sessions, one shared simulated Data API. SQL/RLS semantics
// and raw PATCH protection are separately exercised against PostgreSQL in rls.mjs.
async function api(
  page: Page,
  engineer: number,
  table: string,
  state: { row: Report; writes: number; reads: number },
  code: string,
) {
  const id = `10000000-0000-4000-8000-${String(engineer).padStart(12, "0")}`;
  const user = {
    id,
    email: `engineer${engineer}@example.test`,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
  };
  const part = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: id, exp: 4102444800, role: "authenticated" })}.signature`;
  await page.context().addInitScript(
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
  await page
    .context()
    .route("**/auth/v1/user", (route) => route.fulfill({ json: user }));
  await page.context().route("**/rest/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname.endsWith("/project_memberships"))
      return route.fulfill({
        json: [
          {
            workspace_id: workspace,
            user_id: id,
            project_id: project,
            role: "editor",
            row_version: 1,
          },
        ],
      });
    if (url.pathname.endsWith("/memberships"))
      return route.fulfill({
        json: [
          {
            workspace_id: workspace,
            role: "member",
            workspaces: { id: workspace, name: "Concurrency QA — ข้อมูลสมมติ" },
          },
        ],
      });
    if (url.pathname.endsWith("/projects"))
      return route.fulfill({
        json: [
          {
            id: project,
            workspace_id: workspace,
            name: "โครงการทดสอบ — ข้อมูลสมมติ",
            location: "DEV",
            client: "QA",
            status: "active",
            created_at: state.row.created_at,
          },
        ],
      });
    if (!url.pathname.endsWith(`/${table}`)) return route.fulfill({ json: [] });
    if (req.method() !== "PATCH") {
      state.reads++;
      return route.fulfill({ json: [state.row] });
    }
    state.writes++;
    const body = req.postDataJSON();
    expect(url.searchParams.get("id")).toBe(`eq.${document}`);
    expect(url.searchParams.get("workspace_id")).toBe(`eq.${workspace}`);
    expect(url.searchParams.get("row_version")).toBe(
      `eq.${body.expected_version}`,
    );
    if (body.expected_version !== state.row.row_version)
      return route.fulfill({
        status: code === "40001" ? 409 : 406,
        json: { code, message: "Document changed since it was opened" },
      });
    const { expected_version, ...fields } = body;
    state.row = { ...state.row, ...fields, row_version: expected_version + 1 };
    return route.fulfill({ json: { id: document } });
  });
}

for (const kind of ["report", "request"] as const) {
  const base = kind === "report" ? "/reports" : "/requests";
  const edit = kind === "report" ? "แก้ไข" : "แก้ไขคำขอ";
  for (const code of ["40001", "PGRST116"]) {
    test(`${kind}: two engineers cannot overwrite; ${code} preserves unsaved fields`, async ({
      page,
      browser,
    }) => {
      const second = await browser.newPage({
        baseURL: "http://127.0.0.1:3100",
      });
      const state = { row: original(), writes: 0, reads: 0 };
      await api(page, 1, `daily_${kind}s`, state, code);
      await api(second, 2, `daily_${kind}s`, state, code);
      try {
        for (const p of [page, second]) {
          await p.goto(`${base}/${document}`);
          await p.getByRole("button", { name: edit, exact: true }).click();
        }
        await page
          .getByLabel("รายละเอียดงาน 1", { exact: true })
          .fill("วิศวกร A บันทึกก่อน — ข้อมูลสมมติ");
        await second
          .getByLabel("รายละเอียดงาน 1", { exact: true })
          .fill("วิศวกร B ยังไม่ได้บันทึก — ข้อมูลสมมติ");
        await page
          .getByRole("button", { name: "บันทึกฉบับร่าง", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: edit, exact: true }),
        ).toBeVisible();
        expect(state.row.row_version).toBe(2);
        const reads = state.reads;
        // Focus events must not refresh/unmount the second engineer's editor.
        await second.bringToFront();
        await second
          .getByRole("button", { name: "บันทึกฉบับร่าง", exact: true })
          .click();
        await expect(second.locator('.error[role="alert"]')).toContainText(
          "ระบบไม่ได้บันทึกทับ",
        );
        await expect(
          second.getByLabel("รายละเอียดงาน 1", { exact: true }),
        ).toHaveValue("วิศวกร B ยังไม่ได้บันทึก — ข้อมูลสมมติ");
        await expect(
          second.getByRole("button", { name: "บันทึกฉบับร่าง", exact: true }),
        ).toBeDisabled();
        expect(state.reads).toBe(reads);
        expect(state.row.work_done).toContain("วิศวกร A");
        expect(state.writes).toBe(2);
        const link = second.getByRole("link", {
          name: "เปิดฉบับล่าสุดในแท็บใหม่",
        });
        await expect(link).toHaveAttribute("target", "_blank");
        const popupPromise = second.waitForEvent("popup");
        await link.click();
        const latest = await popupPromise;
        await expect(latest.locator(".print-report")).toContainText("วิศวกร A");
        await latest.getByRole("button", { name: edit, exact: true }).click();
        await latest
          .getByLabel("รายละเอียดงาน 1", { exact: true })
          .fill("รวมข้อมูล B หลังตรวจฉบับล่าสุด");
        await latest
          .getByRole("button", { name: "บันทึกฉบับร่าง", exact: true })
          .click();
        await expect(
          latest.getByRole("button", { name: edit, exact: true }),
        ).toBeVisible();
        expect(state.row.row_version).toBe(3);
        expect(state.row.work_done).toContain("รวมข้อมูล B");
        await expect(
          second.getByLabel("รายละเอียดงาน 1", { exact: true }),
        ).toHaveValue("วิศวกร B ยังไม่ได้บันทึก — ข้อมูลสมมติ");
        if (kind === "request" && code === "40001")
          await second.screenshot({
            path: "output/qa/document-edit-conflict.png",
            fullPage: true,
          });
      } finally {
        await second.context().close();
      }
    });
  }

  test(`${kind}: demo tabs compare latest stored version before writing`, async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" })
      .click();
    await expect(
      page.getByRole("heading", { name: "ภาพรวมหน้างาน" }),
    ).toBeVisible();
    const row = {
      ...original(),
      workspace_id: "11111111-1111-4111-8111-111111111111",
      project_id: "33333333-3333-4333-8333-333333333333",
    };
    await page.evaluate(
      ({ row, kind }) => {
        const key = "site-daily-th:demo:v1",
          data = JSON.parse(
            localStorage.getItem(key) ??
              JSON.stringify({
                projects: [
                  {
                    id: row.project_id,
                    workspace_id: row.workspace_id,
                    name: "QA — ข้อมูลสมมติ",
                    location: "DEV",
                    client: "QA",
                    status: "active",
                    created_at: row.created_at,
                  },
                ],
                reports: [],
                requests: [],
                photos: [],
              }),
          );
        data[kind === "report" ? "reports" : "requests"] = [row];
        localStorage.setItem(key, JSON.stringify(data));
      },
      { row, kind },
    );
    const second = await context.newPage();
    await second.addInitScript(() =>
      sessionStorage.setItem("site-daily-demo", "true"),
    );
    for (const p of [page, second]) {
      await p.goto(`${base}/${document}`);
      await p.getByRole("button", { name: edit, exact: true }).click();
    }
    await page
      .getByLabel("รายละเอียดงาน 1", { exact: true })
      .fill("ฉบับแรกในโหมดทดลอง");
    await second
      .getByLabel("รายละเอียดงาน 1", { exact: true })
      .fill("ฉบับค้างในอีกแท็บ");
    await page
      .getByRole("button", { name: "บันทึกฉบับร่าง", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: edit, exact: true }),
    ).toBeVisible();
    await second
      .getByRole("button", { name: "บันทึกฉบับร่าง", exact: true })
      .click();
    await expect(second.locator('.error[role="alert"]')).toContainText(
      "ระบบไม่ได้บันทึกทับ",
    );
    await expect(
      second.getByLabel("รายละเอียดงาน 1", { exact: true }),
    ).toHaveValue("ฉบับค้างในอีกแท็บ");
    const saved = await page.evaluate(
      (kind) =>
        JSON.parse(localStorage.getItem("site-daily-th:demo:v1")!)[
          kind === "report" ? "reports" : "requests"
        ][0],
      kind,
    );
    expect(saved.row_version).toBe(2);
    expect(saved.work_done).toContain("ฉบับแรก");
    await second.close();
  });
}
