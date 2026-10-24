import { test, expect } from "@playwright/test";
import path from "node:path";
import { installPdfExportFixture } from "./pdf-fixture";

test("latest project report seeds only a new editable request; source is unchanged", async ({
  page,
}) => {
  // Full form + print layout + real local PDF renderer, consistent with other workflows.
  test.setTimeout(60000);
  const workspace = "11111111-1111-4111-8111-111111111111";
  const project = "33333333-3333-4333-8333-333333333333";
  const latest = "77777777-7777-4777-8777-777777777777";
  const older = "66666666-6666-4666-8666-666666666666";
  const other = "88888888-8888-4888-8888-888888888888";
  const foreign = "99999999-9999-4999-8999-999999999999";
  await page.goto("/login");
  await page
    .getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" })
    .click();
  await expect(
    page.getByRole("heading", { name: "ภาพรวมหน้างาน", exact: true }),
  ).toBeVisible();
  await installPdfExportFixture(page);
  const fixture = await page.evaluate(
    ({ workspace, project, latest, older, other, foreign }) => {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const yesterday = new Date(`${date}T12:00:00Z`);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const base = {
        id: latest,
        workspace_id: workspace,
        project_id: project,
        report_date: date,
        weather: "ฝนตก",
        workers: 4,
        work_done: "ไม่ได้ทำงาน — ข้อเท็จจริงเดิม",
        materials: "วัสดุข้อความเดิม",
        equipment: "เครื่องมือข้อความเดิม",
        issues: "ปัญหาเดิม",
        tomorrow: "แผนเก่า",
        status: "submitted",
        created_by: "10000000-0000-4000-8000-000000000001",
        created_at: "2026-01-01T00:00:00Z",
        report_details: {
          version: 1,
          meta: {
            report_number: "HTH-DRP-043-2569",
            doc_code: "DRP",
            revision: "2",
            owner: "เจ้าของตัวอย่าง",
            consultant: "ผู้ควบคุมงานตัวอย่าง",
            logo_set: "hampton",
            reporter: "วิศวกรเดิม",
            notes: "หยุดงาน",
            solution: "แก้ปัญหาเก่า",
            weather_08: "rain",
            tools_count_only: "true",
            request_reference: "old-request",
            request_number: "old-request-number",
          },
          labor: [
            { group: "daily", label: "ช่างโครงสร้าง", count: 4, hours: 8 },
          ],
          equipment: [
            { kind: "tool", label: "แผ่นเหล็ก", count: 80, hours: 0 },
          ],
          material_rows: [
            {
              label: "เหล็ก DB16",
              kind: "used",
              quantity: 5,
              unit: "เส้น",
              notes: "คงตรวจสอบ",
            },
          ],
          progress: [
            {
              time: "08:00",
              description: "ไม่ได้ทำงาน",
              unit: "",
              quantity: 0,
            },
          ],
        },
      };
      const data = {
        projects: [
          {
            id: project,
            workspace_id: workspace,
            name: "Hampton QA",
            location: "DEV",
            client: "เจ้าของตัวอย่าง",
            status: "active",
            created_at: base.created_at,
          },
          {
            id: other,
            workspace_id: workspace,
            name: "โครงการอื่น",
            location: "DEV",
            client: "",
            status: "active",
            created_at: base.created_at,
          },
        ],
        reports: [
          {
            ...base,
            id: older,
            report_date: yesterday.toISOString().slice(0, 10),
            created_at: "2026-12-01T00:00:00Z",
            report_details: {
              ...base.report_details,
              meta: { ...base.report_details.meta, report_number: "OLD-DRP" },
            },
          },
          {
            ...base,
            id: other,
            project_id: other,
            created_at: "2026-12-02T00:00:00Z",
          },
          {
            ...base,
            id: foreign,
            workspace_id: "00000000-0000-4000-8000-000000000000",
            created_at: "2026-12-03T00:00:00Z",
          },
          base,
        ],
        photos: [],
        requests: [],
      };
      localStorage.setItem("site-daily-th:demo:v1", JSON.stringify(data));
      return { reports: data.reports, date };
    },
    { workspace, project, latest, older, other, foreign },
  );
  await page.goto("/requests");
  await page
    .getByRole("link", {
      name: "สร้างจาก Daily Report ล่าสุด — Hampton QA",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`fromReport=${latest}`));
  await expect(
    page.getByRole("combobox", { name: "โครงการ", exact: true }),
  ).toHaveValue(project);
  await expect(page.getByLabel("เลขที่คำขอ", { exact: true })).toHaveValue(
    "HTH-DRQ-043-2569",
  );
  await expect(page.getByLabel("วันที่ขอทำงาน", { exact: true })).toHaveValue(
    fixture.date,
  );
  await expect(page.locator("form section")).toHaveCount(3);
  for (const label of [
    "จำนวนคน 1",
    "รายการเครื่องจักร 1",
    "รายการวัสดุ 1",
    "หมายเหตุ",
    "ปริมาณงาน 1",
  ]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
  }
  await expect(
    page.getByLabel("ชื่อผู้ขออนุมัติ", { exact: true }),
  ).toHaveValue("วิศวกรเดิม");
  await expect(page.getByLabel("เวลาเริ่มงาน 1", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("เวลาเสร็จงาน 1", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("รายละเอียดงาน 1", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByLabel("ความเสี่ยง / ข้อควรระวังก่อนเริ่มงาน", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "บันทึกฉบับร่าง", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("site-daily-th:demo:v1")!).requests
          .length,
    ),
  ).toBe(0);
  await page
    .getByLabel("รายละเอียดงาน 1", { exact: true })
    .fill("แผนใหม่: ตรวจแนวและระดับก่อนเริ่มงาน");
  await page.getByLabel("เวลาเริ่มงาน 1", { exact: true }).fill("08:00");
  await page.getByLabel("เวลาเสร็จงาน 1", { exact: true }).fill("17:00");
  await page.screenshot({
    path: "test-results/qa/request-from-latest-report.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "บันทึกฉบับร่าง", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "แก้ไขคำขอ", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("site-daily-th:demo:v1")!),
  );
  expect(saved.reports).toEqual(fixture.reports);
  expect(saved.requests).toHaveLength(1);
  expect(saved.requests[0].id).not.toBe(latest);
  expect(saved.requests[0].status).toBe("draft");
  expect(saved.requests[0].created_by).toBe(
    "22222222-2222-4222-8222-222222222222",
  );
  expect(saved.requests[0].workers).toBe(0);
  expect(saved.requests[0].materials).toBe("");
  expect(saved.requests[0].equipment).toBe("");
  expect(saved.requests[0].report_details.labor).toEqual([]);
  expect(saved.requests[0].report_details.equipment).toEqual([]);
  expect(saved.requests[0].report_details.material_rows).toEqual([]);
  expect(saved.requests[0].report_details.progress[0].time).toBe("08:00–17:00");
  expect(saved.requests[0].report_details.meta.source_report_id).toBe(latest);
  expect(
    saved.requests[0].report_details.meta.request_reference,
  ).toBeUndefined();
  expect(saved.requests[0].report_details.meta.weather_08).toBeUndefined();
  // Existing requests retain hidden resource data when only the plan is edited.
  const legacy = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("site-daily-th:demo:v1")!);
    const r = data.requests[0],
      source = data.reports.at(-1);
    r.report_details.labor = source.report_details.labor;
    r.report_details.equipment = source.report_details.equipment;
    r.report_details.material_rows = source.report_details.material_rows;
    r.materials = source.materials;
    r.equipment = source.equipment;
    r.issues = source.issues;
    r.workers = source.workers;
    r.report_details.progress = Array.from({ length: 3 }, (_, i) => ({
      description: `${i + 1} ` + "W".repeat(980) + ` ท้ายงาน ${i + 1}`,
      time: "08:00–17:00",
      unit: "",
      quantity: null,
    }));
    localStorage.setItem("site-daily-th:demo:v1", JSON.stringify(data));
    return r;
  });
  await page.reload();
  await expect(page.locator(".print-report")).not.toContainText("เหล็ก DB16");
  await page.getByRole("button", { name: "แก้ไขคำขอ", exact: true }).click();
  await expect(page.locator("form section")).toHaveCount(3);
  await expect(page.getByLabel("จำนวนคน 1", { exact: true })).toHaveCount(0);
  await page.getByLabel("เวลาเริ่มงาน 1", { exact: true }).fill("09:00");
  await page
    .getByRole("button", { name: "บันทึกฉบับร่าง", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "แก้ไขคำขอ", exact: true }),
  ).toBeVisible();
  const edited = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("site-daily-th:demo:v1")!).requests[0],
  );
  for (const key of ["labor", "equipment", "material_rows"])
    expect(edited.report_details[key]).toEqual(legacy.report_details[key]);
  for (const key of ["materials", "equipment", "issues", "workers"])
    expect(edited[key]).toEqual(legacy[key]);
  expect(edited.report_details.progress[0].time).toBe("09:00–17:00");
  const sheets = await page.locator(".dr-request-sheet").count();
  expect(sheets).toBeGreaterThan(1);
  await page.emulateMedia({ media: "print" });
  const dimensions = await page
    .locator(".dr-request-sheet")
    .evaluateAll((els) =>
      els.map((el) => ({
        height: el.getBoundingClientRect().height,
        scroll: el.scrollHeight,
        width: el.getBoundingClientRect().width,
        scrollWidth: el.scrollWidth,
      })),
    );
  for (const size of dimensions) {
    expect(size.height).toBeLessThanOrEqual(1048);
    expect(size.scroll).toBeLessThanOrEqual(1048);
    expect(size.scrollWidth).toBeLessThanOrEqual(Math.ceil(size.width));
  }
  await page.emulateMedia({ media: "screen" });
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ส่งออก Daily Request PDF", exact: true })
    .click();
  await (
    await downloaded
  ).saveAs(path.resolve("test-results/qa/daily-request-long.pdf"));
  for (const source of [other, foreign, "missing"]) {
    await page.goto(`/requests/new?project=${project}&fromReport=${source}`);
    await expect(
      page.getByText("ไม่พบรายงานต้นฉบับในบริษัทหรือโครงการนี้", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "บันทึกฉบับร่าง", exact: true }),
    ).toHaveCount(0);
  }
});
