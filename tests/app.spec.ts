import { test, expect } from "@playwright/test";
import path from "node:path";
import { installPdfExportFixture } from "./pdf-fixture";

test("legacy report with empty details exports PDF", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/login");
  await page
    .getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" })
    .click();
  await expect(
    page.getByRole("heading", { name: "ภาพรวมหน้างาน" }),
  ).toBeVisible();
  await installPdfExportFixture(page);
  await page.evaluate(() => {
    const key = "site-daily-th:demo:v1";
    const legacy = {
      id: "66666666-6666-4666-8666-666666666666",
      workspace_id: "11111111-1111-4111-8111-111111111111",
      project_id: "33333333-3333-4333-8333-333333333333",
      report_date: "2026-10-23",
      weather: "แดดออก",
      workers: 14,
      work_done: "รายงานรุ่นเก่าสำหรับตรวจ PDF",
      materials: "",
      equipment: "",
      issues: "",
      safety: "",
      tomorrow: "",
      status: "submitted",
      created_at: new Date().toISOString(),
      created_by: "22222222-2222-4222-8222-222222222222",
      report_details: {},
    };
    localStorage.setItem(
      key,
      JSON.stringify({
        projects: [
          {
            id: legacy.project_id,
            workspace_id: legacy.workspace_id,
            name: "Legacy PDF QA",
            location: "DEV",
            client: "Test",
            status: "active",
            created_at: legacy.created_at,
          },
        ],
        reports: [legacy],
        photos: [],
      }),
    );
  });
  await page.goto("/reports/66666666-6666-4666-8666-666666666666");
  await expect(
    page.getByRole("button", { name: "ส่งออก PDF", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "ส่งออก PDF", exact: true }).click();
  await (
    await download
  ).saveAs(path.resolve("test-results/qa/legacy-report.pdf"));
  await expect(page.locator('.error[role="alert"]')).toHaveCount(0);
});

test("password recovery sends email with local callback and blocks unauthenticated updates", async ({
  page,
}) => {
  await page.route("**/auth/v1/recover**", async (route) => {
    const request = route.request();
    expect(request.postDataJSON().email).toBe("recovery-test@example.com");
    expect(new URL(request.url()).searchParams.get("redirect_to")).toBe(
      "http://127.0.0.1:3100/update-password",
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/login");
  await page.getByRole("link", { name: "ลืมรหัสผ่าน?" }).click();
  // Both pages have an email field: wait for the destination before filling it.
  await expect(
    page.getByRole("heading", { name: "กู้รหัสผ่าน", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("อีเมล", { exact: true })
    .fill("recovery-test@example.com");
  await page.getByRole("button", { name: "ส่งลิงก์กู้รหัสผ่าน" }).click();
  await expect(page.getByRole("status")).toContainText("ส่งคำขอแล้ว");
  await page.goto("/update-password");
  await expect(page.getByLabel("รหัสผ่านใหม่", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }),
  ).toBeDisabled();
});
test("unauthenticated routes require login", async ({ page, request }) => {
  const foreign = await request.post("/api/reports/pdf", {
    headers: { Origin: "https://other.example" },
    data: { html: "<article class=print-report>test</article>", css: "" },
  });
  expect(foreign.status()).toBe(403);
  await page.goto("/reports/new");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบ", exact: true }),
  ).toBeVisible();
});
test("complete construction workflow, persistence, photos and Thai print", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page
    .getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" })
    .click();
  await expect(
    page.getByRole("heading", { name: "ภาพรวมหน้างาน" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/qa/dashboard-desktop.png",
    fullPage: true,
  });
  const photoFixture = await page
    .locator(".project-cover")
    .first()
    .screenshot();
  await installPdfExportFixture(page);
  await page.getByRole("link", { name: "โครงการ", exact: true }).click();
  await page.getByRole("button", { name: "สร้างโครงการ", exact: true }).click();
  await page
    .getByLabel("ชื่อโครงการ", { exact: true })
    .fill("อาคารทดสอบ เชียงใหม่");
  await page
    .getByLabel("สถานที่", { exact: true })
    .fill("อำเภอเมือง เชียงใหม่");
  await page.getByLabel("ลูกค้า / เจ้าของงาน").fill("บริษัท ทดสอบ จำกัด");
  await page.getByRole("button", { name: "บันทึกโครงการ" }).click();
  await page
    .getByRole("link", { name: /Daily Report/ })
    .first()
    .click();
  await page.getByRole("link", { name: "สร้างรายงาน", exact: true }).click();
  await page
    .getByRole("combobox", { name: "โครงการ", exact: true })
    .selectOption({ label: "อาคารทดสอบ เชียงใหม่" });
  const today = await page
    .getByLabel("วันที่รายงาน", { exact: true })
    .getAttribute("max");
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  await page
    .getByLabel("วันที่รายงาน", { exact: true })
    .fill(yesterday.toISOString().slice(0, 10));
  await expect(
    page.locator(
      "input[name=workers], select[name=weather], textarea[name=work_done]",
    ),
  ).toHaveCount(0);
  await page
    .getByLabel("รายละเอียดงาน 1", { exact: true })
    .fill("ตรวจเหล็กเสริมและเทคอนกรีตฐานราก 6 ฐาน\nตรวจสอบระดับก่อนเริ่มงาน");
  await page
    .getByLabel("ปัญหา / อุปสรรค / ความปลอดภัย")
    .fill("ไม่มีอุบัติเหตุ");
  await expect(
    page.getByRole("heading", { name: "รายละเอียดหน้างาน", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "เพิ่มวัสดุ", exact: true }).click();
  await page.getByLabel("รายการวัสดุ 1", { exact: true }).fill("คอนกรีตทดสอบ");
  await page.getByLabel("จำนวนวัสดุ 1", { exact: true }).fill("12.5");
  await page.getByLabel("หน่วยวัสดุ 1", { exact: true }).fill("ลบ.ม.");
  await page
    .getByLabel("หมายเหตุวัสดุ 1", { exact: true })
    .fill("ทดสอบรับเข้า");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("navigation", { name: "หมวดรายงาน" })
    .getByRole("link", { name: /วัสดุ/ })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".report-section-nav")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBeLessThan(90);
  await expect(page.getByLabel("รายการวัสดุ 1", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/qa/report-form-mobile.png",
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("navigation", { name: "หมวดรายงาน" })
    .getByRole("link", { name: /วัสดุ/ })
    .click();
  await page.screenshot({
    path: "test-results/qa/report-form-desktop.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "บันทึกและส่งรายงาน" }).click();
  await expect(page.locator(".print-report")).toContainText("0 คน");
  await expect(page.locator(".print-report")).toContainText("ส่งรายงานแล้ว");
  // Simulate the previous form's stored fields in this isolated demo only.
  await page.evaluate(() => {
    const key = "site-daily-th:demo:v1",
      data = JSON.parse(localStorage.getItem(key)!);
    const report = data.reports.find(
      (r: { id: string }) => r.id === location.pathname.split("/").at(-1),
    );
    Object.assign(report, {
      materials: "เหล็กเดิม 20 เส้น",
      equipment: "เครื่องมือเดิม ต้องเก็บ",
      tomorrow: "แผนเดิม ต้องเก็บ",
    });
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
  await page
    .getByLabel("เลขที่รายงาน", { exact: true })
    .fill("DEV-DRP-041-2569");
  await page
    .getByLabel("ส่วนงาน", { exact: true })
    .selectOption("งานโครงสร้าง");
  await page.getByLabel("ช่วงเวลากลางวัน", { exact: true }).fill("07:00–16:00");
  await page.getByRole("checkbox", { name: "กลางคืน", exact: true }).check();
  await page.getByRole("checkbox", { name: "กลางวัน", exact: true }).uncheck();
  await expect(page.getByLabel("ช่วงเวลากลางคืน", { exact: true })).toHaveValue(
    "18:00–21:00",
  );
  await page.getByRole("checkbox", { name: "กลางวัน", exact: true }).check();
  await expect(page.getByLabel("ช่วงเวลากลางวัน", { exact: true })).toHaveValue(
    "07:00–16:00",
  );
  await page.getByLabel("ช่วงเวลากลางคืน", { exact: true }).fill("18:00–21:00");
  await page
    .getByRole("checkbox", {
      name: "ใช้โลโก้ APOLLO ASSET / AMPERSAND ACE / 27 ENGINEERING ในหัวรายงาน",
      exact: true,
    })
    .check();
  for (const [i, group, label, count] of [
    [1, "staff", "วิศวกร", 1],
    [2, "daily", "ช่าง", 8],
    [3, "subcontract", "ผู้รับเหมา", 11],
  ] as const) {
    await page
      .getByRole("button", {
        name:
          group === "daily"
            ? "เพิ่มพนักงานรายวัน"
            : group === "subcontract"
              ? "เพิ่มผู้รับเหมา"
              : "เพิ่มบุคลากร",
        exact: true,
      })
      .click();
    await page
      .getByRole("combobox", { name: `ประเภทบุคลากร ${i}`, exact: true })
      .selectOption(group);
    await page.getByLabel(`รายการบุคลากร ${i}`, { exact: true }).fill(label);
    await page.getByLabel(`จำนวนคน ${i}`, { exact: true }).fill(String(count));
  }
  await page
    .getByRole("button", { name: "เพิ่มเครื่องจักร / เครื่องมือ", exact: true })
    .click();
  await page.getByLabel("รายการเครื่องจักร 1", { exact: true }).fill("รถขุด");
  await page.getByLabel("จำนวนเครื่อง 1", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "เพิ่มเครื่องมือ", exact: true })
    .click();
  await page
    .getByLabel("รายการเครื่องจักร 2", { exact: true })
    .fill("ตู้เชื่อม");
  await page.getByLabel("จำนวนเครื่อง 2", { exact: true }).fill("2");
  await page
    .getByRole("checkbox", {
      name: "เครื่องมือ: บันทึกเฉพาะจำนวน ไม่ระบุชั่วโมงใช้งาน",
      exact: true,
    })
    .check();
  await page
    .getByRole("combobox", { name: /^08:00–09:00/ })
    .selectOption("มีเมฆมาก");
  await page
    .getByRole("combobox", { name: /^09:00–10:00/ })
    .selectOption("ฝนตก");
  await page
    .getByLabel("รายละเอียดงาน 1", { exact: true })
    .fill("ติดตั้งแบบหล่อฐานราก");
  await page.getByLabel("หน่วยงาน 1", { exact: true }).fill("ฐาน");
  await page.getByLabel("ปริมาณงาน 1", { exact: true }).fill("3");
  await page
    .getByLabel("หมายเหตุ", { exact: true })
    .fill("ตรวจหมายเหตุแยกจากรายละเอียดงาน");
  await page.getByRole("button", { name: "บันทึกและส่งรายงาน" }).click();
  await expect(page.locator(".print-report")).toContainText("19 คน");
  await expect(page.locator(".print-report")).toContainText("152 คน-ชม.");
  await expect(page.locator(".print-report")).toContainText(
    "ตรวจหมายเหตุแยกจากรายละเอียดงาน",
  );
  await expect(page.locator(".print-report")).not.toContainText(
    "รายละเอียดงานเพิ่มเติม",
  );
  await expect(page.locator(".print-report")).not.toContainText(
    "ตรวจเหล็กเสริมและเทคอนกรีตฐานราก",
  );
  await expect(page.locator(".print-report")).toContainText("DEV-DRP-041-2569");
  await page.getByLabel("เลือกรูปภาพ").setInputFiles({
    name: "site.png",
    mimeType: "image/png",
    buffer: photoFixture,
  });
  await page
    .getByLabel("คำบรรยาย", { exact: true })
    .fill("ตัวอย่างภาพทดสอบการแนบรูป");
  await page
    .getByRole("button", { name: "อัปโหลดรูปภาพ", exact: true })
    .click();
  await expect(
    page
      .locator(".print-report")
      .getByRole("img", { name: "ตัวอย่างภาพทดสอบการแนบรูป" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".print-report")).toContainText("19 คน");
  await expect(page.locator(".print-report")).toContainText(
    "เหล็กเดิม 20 เส้น",
  );
  await expect(page.locator(".print-report")).toContainText(
    "เครื่องมือเดิม ต้องเก็บ",
  );
  await expect(page.locator(".print-report")).toContainText("แผนเดิม ต้องเก็บ");
  await expect(page.locator(".photo-grid img")).toHaveCount(1);
  await expect(page.locator(".dr-material-table")).toContainText(
    "คอนกรีตทดสอบ",
  );
  await expect(page.locator(".dr-material-table")).toContainText("12.5");
  await expect(
    page.locator(".dr-matrix > section:nth-child(2) .dr-material-table"),
  ).toHaveCount(0);
  await expect(
    page.locator(".dr-matrix > section:nth-child(3) .dr-material-table"),
  ).toHaveCount(1);
  await expect(page.locator(".dr-discipline-selected")).toHaveCount(2);
  await expect(page.locator(".dr-discipline-selected").first()).toHaveText(
    "งานโครงสร้าง",
  );

  await expect(page.locator(".dr-material-table")).toContainText("ลบ.ม.");
  await expect(page.locator(".dr-logo-brand")).toHaveCount(2);
  await expect(page.locator('.dr-shift-box[data-selected="true"]')).toHaveCount(
    4,
  );
  await expect(page.locator(".print-report")).toContainText("18:00–21:00");
  await expect(page.locator(".print-report")).not.toContainText(
    "สีอ่อน = ยังไม่บันทึกรายชั่วโมง",
  );
  await expect(page.locator(".dr-logo-brand img")).toHaveCount(6);
  await expect(page.locator(".dr-logo-brand img").first()).toHaveAttribute(
    "alt",
    "APOLLO ASSET",
  );
  await expect(page.locator(".print-report")).toContainText("รวมพนักงานรายวัน");
  await expect(page.locator(".print-report")).toContainText("รวมผู้รับเหมา");
  await expect(page.locator(".print-report")).toContainText("ตู้เชื่อม");
  await expect(
    page.locator(".print-report .weather-clock").first().locator("path").nth(2),
  ).toHaveAttribute("fill", "#00aeef");
  await expect(
    page.locator(".print-report .weather-clock").first().locator("path").nth(3),
  ).toHaveAttribute("fill", "#a6a6a6");
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "ส่งออก PDF", exact: true }).click();
  await (
    await exported
  ).saveAs(path.resolve("test-results/qa/sample-daily-report-th.pdf"));
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.screenshot({
    path: "test-results/qa/report-print.png",
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen" });
  const sourceId = page.url().split("/").at(-1)!;
  const original = await page.evaluate(
    (id) =>
      JSON.stringify(
        JSON.parse(localStorage.getItem("site-daily-th:demo:v1")!).reports.find(
          (r: { id: string }) => r.id === id,
        ),
      ),
    sourceId,
  );
  await page
    .getByRole("link", { name: "สร้างรายงานวันถัดไป", exact: true })
    .click();
  await expect(page.getByLabel("วันที่รายงาน", { exact: true })).toHaveValue(
    today!,
  );
  await expect(page.getByLabel("เลขที่รายงาน", { exact: true })).toHaveValue(
    "DEV-DRP-042-2569",
  );
  await expect(page.getByLabel("จำนวนวัสดุ 1", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("ปริมาณงาน 1", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("combobox", { name: /^08:00–09:00/ }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "หมายเหตุ", exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("จำนวนคน 2", { exact: true })).toHaveValue("8");
  await page
    .getByRole("button", { name: "บันทึกฉบับร่าง", exact: true })
    .click();
  await expect(page.locator(".print-report")).toContainText("DEV-DRP-042-2569");
  expect(page.url()).not.toContain(sourceId);
  await expect(page.locator(".photo-grid img")).toHaveCount(0);
  await expect(page.locator(".dr-sheet")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "รูปถ่ายความก้าวหน้างาน", exact: true }),
  ).toHaveCount(0);
  const noPhotosPdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "ส่งออก PDF", exact: true }).click();
  await (
    await noPhotosPdf
  ).saveAs(path.resolve("test-results/qa/sample-no-photos-report-th.pdf"));
  expect(
    await page.evaluate(
      (id) =>
        JSON.stringify(
          JSON.parse(
            localStorage.getItem("site-daily-th:demo:v1")!,
          ).reports.find((r: { id: string }) => r.id === id),
        ),
      sourceId,
    ),
  ).toBe(original);
  await page.goto(`/reports/${sourceId}`);
  await page
    .getByRole("link", { name: "สร้างรายงานวันถัดไป", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "มีรายงานวันถัดไปแล้ว", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "รูปภาพหน้างาน", exact: true }).click();
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.locator(".gallery-card").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "ลบรูป", exact: true }).click();
  await expect(page.locator(".photo-grid img")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "ภาพรวมหน้างาน" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/qa/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "เปิดเมนู" }).click();
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
