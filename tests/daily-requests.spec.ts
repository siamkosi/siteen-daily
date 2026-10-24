import { test, expect } from "@playwright/test";
import path from "node:path";
import { installPdfExportFixture } from "./pdf-fixture";

test("daily request plan, external-signature PDF, paired actual report and duplicate protection", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page
    .getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" })
    .click();
  await page.getByRole("link", { name: "โครงการ", exact: true }).click();
  await page.getByRole("button", { name: "สร้างโครงการ", exact: true }).click();
  await page
    .getByLabel("ชื่อโครงการ", { exact: true })
    .fill("DEV Daily Request QA — ข้อมูลสมมติ");
  await page
    .getByRole("button", { name: "บันทึกโครงการ", exact: true })
    .click();
  await page.getByRole("link", { name: "Daily Request", exact: true }).click();
  await page
    .getByRole("link", { name: "สร้าง Daily Request", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "โครงการ", exact: true })
    .selectOption({ label: "DEV Daily Request QA — ข้อมูลสมมติ" });
  const date = await page
    .getByLabel("วันที่ขอทำงาน", { exact: true })
    .inputValue();
  await installPdfExportFixture(page);
  await page.getByLabel("เลขที่คำขอ", { exact: true }).fill("DEV-DRQ-QA-2569");
  await page
    .getByLabel("ชื่อผู้ขออนุมัติ", { exact: true })
    .fill("วิศวกรสนามตัวอย่าง");
  await page
    .getByLabel("ตำแหน่งผู้ขออนุมัติ", { exact: true })
    .fill("Site Engineer");
  await page
    .getByLabel("ชื่อผู้ควบคุมงาน / ผู้อนุมัติ", { exact: true })
    .fill("ผู้ควบคุมงานตัวอย่าง");
  await expect(page.locator(".report-section-nav a")).toHaveText([
    "01ข้อมูลทั่วไป",
    "02เอกสาร / ผู้ขอ",
    "06แผนงานขออนุมัติ",
  ]);
  await expect(page.locator("form section")).toHaveCount(3);
  await expect(page.getByLabel("หมายเหตุ", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("ปริมาณงาน 1", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "เพิ่มพนักงานรายวัน", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel(
      "ใช้โลโก้ APOLLO ASSET / AMPERSAND ACE / 27 ENGINEERING ในหัวรายงาน",
    )
    .check();
  await page
    .getByLabel("รายละเอียดงาน 1", { exact: true })
    .fill("ขออนุมัติตรวจแบบหล่อและเตรียมเทคอนกรีต — ข้อมูลสมมติ");
  await page.getByLabel("เวลาเริ่มงาน 1", { exact: true }).fill("08:00");
  await page.getByLabel("เวลาเสร็จงาน 1", { exact: true }).fill("12:00");
  await page
    .getByRole("button", { name: "บันทึกฉบับร่าง", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "แก้ไขคำขอ", exact: true }),
  ).toBeVisible();
  const requestUrl = page.url();
  await page.reload();
  await expect(page.locator(".print-report")).toContainText(
    "เอกสารขออนุมัติทำงานประจำวัน",
  );
  await expect(page.locator(".print-report")).toContainText("08:00");
  await expect(page.locator(".print-report")).toContainText("12:00");
  await expect(page.locator(".print-report")).not.toContainText("บุคลากร");
  await expect(page.locator(".print-report")).not.toContainText("เครื่องจักร");
  await expect(page.locator(".print-report")).not.toContainText("วัสดุ");
  await page.getByRole("button", { name: "แก้ไขคำขอ", exact: true }).click();
  await expect(
    page.getByLabel("รายละเอียดงาน 1", { exact: true }),
  ).toContainText("ขออนุมัติ");
  await expect(page.getByLabel("เวลาเริ่มงาน 1", { exact: true })).toHaveValue(
    "08:00",
  );
  await expect(page.getByLabel("เวลาเสร็จงาน 1", { exact: true })).toHaveValue(
    "12:00",
  );
  await page
    .getByRole("button", { name: "บันทึกและส่งคำขอ", exact: true })
    .click();
  await expect(page.locator(".print-report")).toContainText("รอลงนามภายนอก");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ส่งออก Daily Request PDF", exact: true })
    .click();
  await (
    await downloaded
  ).saveAs(path.resolve("test-results/qa/daily-request-sample.pdf"));
  await page.screenshot({
    path: "test-results/qa/daily-request-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "สร้าง Daily Report จากคำขอนี้", exact: true })
    .click();
  await expect(page.getByLabel("วันที่รายงาน", { exact: true })).toHaveValue(
    date,
  );
  await expect(page.locator(".report-section-nav a")).toHaveCount(7);
  await expect(page.getByLabel("จำนวนคน 1", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "เพิ่มพนักงานรายวัน", exact: true })
    .click();
  await page
    .getByLabel("รายการบุคลากร 1", { exact: true })
    .fill("ช่างโครงสร้าง (ผลจริง)");
  await expect(page.getByLabel("ปริมาณงาน 1", { exact: true })).toHaveValue("");
  await page.getByLabel("จำนวนคน 1", { exact: true }).fill("10");
  await page.getByLabel("ชั่วโมงต่อคน 1", { exact: true }).fill("7");
  await page
    .getByLabel("รายละเอียดงาน 1", { exact: true })
    .fill("ผลจริงทดสอบ: ตรวจแบบหล่อครบ 5 ฐาน");
  await page
    .getByRole("button", { name: "บันทึกและส่งรายงาน", exact: true })
    .click();
  await expect(
    page.getByRole("link", {
      name: "เปิด Daily Request ของวันเดียวกัน",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "เปิด Daily Request ของวันเดียวกัน",
      exact: true,
    }),
  ).toHaveClass("button secondary");
  await page.goto(requestUrl);
  await expect(
    page.getByRole("link", {
      name: "เปิด Daily Report ของวันเดียวกัน",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "เปิด Daily Report ของวันเดียวกัน",
      exact: true,
    }),
  ).toHaveClass("button secondary");
  await expect(
    page.getByRole("link", { name: "ไปที่ Daily Request", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".print-report")).toContainText("08:00");
  await expect(page.locator(".print-report")).not.toContainText("ผลจริงทดสอบ");
  await page.getByRole("link", { name: "คำขอทั้งหมด", exact: true }).click();
  await page
    .getByRole("link", { name: "สร้าง Daily Request", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "โครงการ", exact: true })
    .selectOption({ label: "DEV Daily Request QA — ข้อมูลสมมติ" });
  await page.getByLabel("รายละเอียดงาน 1", { exact: true }).fill("คำขอซ้ำ");
  await page.getByLabel("เวลาเริ่มงาน 1", { exact: true }).fill("22:00");
  await page.getByLabel("เวลาเสร็จงาน 1", { exact: true }).fill("02:00");
  await expect(page.getByText("เสร็จวันถัดไป", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "บันทึกและส่งคำขอ", exact: true })
    .click();
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "มี Daily Request",
  );
  const future = new Date(`${date}T12:00:00Z`);
  future.setUTCDate(future.getUTCDate() + 1);
  await page
    .getByLabel("วันที่ขอทำงาน", { exact: true })
    .fill(future.toISOString().slice(0, 10));
  await page
    .getByRole("button", { name: "บันทึกและส่งคำขอ", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "แก้ไขคำขอ", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".print-report")).toContainText("02:00 (วันถัดไป)");
  await expect(
    page.getByRole("link", {
      name: "สร้าง Daily Report จากคำขอนี้",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/qa/daily-request-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
