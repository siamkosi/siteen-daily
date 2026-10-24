import { test, expect } from "@playwright/test";
import { installPdfExportFixture } from "./pdf-fixture";
import { readFile } from "node:fs/promises";

for (const kind of ["report", "request"] as const) {
  test(`${kind}: trash, restore, cancel with history, immutable attachments and titled PDF`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.goto("/login");
    await page
      .getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" })
      .click();
    const id = await page.evaluate((kind) => {
      const key = "site-daily-th:demo:v1";
      // A fresh demo seed exists in React until the first write; initialize from the known demo page via a project write first below.
      const saved = localStorage.getItem(key);
      if (!saved) return null;
      const data = JSON.parse(saved);
      const r = {
        ...data.reports[0],
        id: crypto.randomUUID(),
        status: "draft",
        report_date: "2026-10-01",
        work_done: "เอกสารทดสอบถังขยะ — ข้อมูลสมมติ",
        updated_at: new Date().toISOString(),
      };
      const name = kind === "report" ? "reports" : "requests";
      data[name] = [...(data[name] ?? []), r];
      localStorage.setItem(key, JSON.stringify(data));
      return r.id;
    }, kind);
    let documentId = id;
    if (!documentId) {
      // Persist the built-in demo through an ordinary reversible project edit.
      await page.goto("/projects");
      await page
        .getByRole("button", { name: "สร้างโครงการ", exact: true })
        .click();
      await page
        .getByLabel("ชื่อโครงการ", { exact: true })
        .fill("QA ถังขยะ ข้อมูลสมมติ");
      await page
        .getByRole("button", { name: "บันทึกโครงการ", exact: true })
        .click();
      documentId = await page.evaluate((kind) => {
        const key = "site-daily-th:demo:v1",
          data = JSON.parse(localStorage.getItem(key)!);
        const r = {
          ...data.reports[0],
          id: crypto.randomUUID(),
          status: "draft",
          report_date: "2026-10-01",
          work_done: "เอกสารทดสอบถังขยะ — ข้อมูลสมมติ",
          updated_at: new Date().toISOString(),
        };
        const name = kind === "report" ? "reports" : "requests";
        data[name] = [...(data[name] ?? []), r];
        localStorage.setItem(key, JSON.stringify(data));
        return r.id;
      }, kind);
    }
    const route = `/${kind === "report" ? "reports" : "requests"}/${documentId}`;
    await page.goto(route);
    await page
      .getByRole("button", { name: "ย้ายร่างไปถังขยะ", exact: true })
      .click();
    await page
      .getByRole("button", { name: "ยืนยันย้ายไปถังขยะ", exact: true })
      .click();
    await expect(
      page.getByText("สถานะ: อยู่ในถังขยะ", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".print-report")).toHaveCount(0);
    await page.goto(kind === "report" ? "/reports" : "/requests");
    await expect(page.locator(`a[href="${route}"]`)).toHaveCount(0);
    await page.goto("/trash");
    await expect(page.locator(`a[href="${route}"]`)).toBeVisible();
    await page.getByRole("button", { name: "กู้คืนร่าง", exact: true }).click();
    await page
      .getByRole("button", { name: "ยืนยันกู้คืนร่าง", exact: true })
      .click();
    await expect(
      page.getByText("ไม่มีร่างในถังขยะ", { exact: true }),
    ).toBeVisible();
    // Submit via the fixture data boundary so the test isolates lifecycle from form validation.
    await page.evaluate(
      ({ id, kind }) => {
        const key = "site-daily-th:demo:v1",
          data = JSON.parse(localStorage.getItem(key)!);
        const name = kind === "report" ? "reports" : "requests";
        data[name].find((r: { id: string }) => r.id === id).status =
          "submitted";
        localStorage.setItem(key, JSON.stringify(data));
      },
      { id: documentId, kind },
    );
    await page.goto(route);
    await expect(
      page.getByRole("button", { name: "ย้ายร่างไปถังขยะ", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "ยกเลิกเอกสาร", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "ยืนยันยกเลิกเอกสาร", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("เหตุผลที่ยกเลิก", { exact: true })
      .fill("แผนงานเปลี่ยน เก็บเอกสารเดิมเป็นหลักฐาน");
    await page
      .getByRole("button", { name: "ยืนยันยกเลิกเอกสาร", exact: true })
      .click();
    await expect(
      page
        .locator(".document-actions")
        .getByText("สถานะ: ยกเลิกแล้ว", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: kind === "report" ? "แก้ไข" : "แก้ไขคำขอ",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(page.locator(".upload-panel")).toHaveCount(0);
    await page.locator(".document-history > summary").click();
    await expect(page.locator(".document-history")).toContainText(
      "ย้ายไปถังขยะ",
    );
    await expect(page.locator(".document-history")).toContainText("กู้คืนร่าง");
    await expect(page.locator(".document-history")).toContainText(
      "แผนงานเปลี่ยน เก็บเอกสารเดิมเป็นหลักฐาน",
    );
    await installPdfExportFixture(page, true);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: kind === "report" ? "ส่งออก PDF" : "ส่งออก Daily Request PDF",
        exact: true,
      })
      .click();
    const pdf = await download;
    expect(pdf.suggestedFilename()).not.toContain("about");
    await pdf.saveAs(`output/pdf/qa-cancelled-${kind}.pdf`);
    const bytes = await readFile(`output/pdf/qa-cancelled-${kind}.pdf`);
    expect(bytes.toString("latin1")).toContain(
      `/Title (${kind === "report" ? "Daily Report" : "Daily Request"} - ${pdf.suggestedFilename().replace(/\.pdf$/, "")} | SiteEN DAILY)`,
    );
    await page.screenshot({
      path: `output/qa/cancelled-${kind}.png`,
      fullPage: false,
    });
    await page.reload();
    await expect(
      page
        .locator(".document-actions")
        .getByText("สถานะ: ยกเลิกแล้ว", { exact: true }),
    ).toBeVisible();
  });
}
