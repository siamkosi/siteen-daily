import { test, expect } from "@playwright/test";

test("public login hides demo and ignores a previously saved demo session", async ({
  page,
}) => {
  // Serve the local build under a reserved public hostname; no real site requests.
  await page.route("https://siteen.example.test/**", async (route) => {
    const target = new URL(route.request().url());
    target.protocol = "http:";
    target.host = "127.0.0.1:3100";
    await route.fulfill({
      response: await route.fetch({ url: target.toString() }),
    });
  });
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({ status: 401, json: { message: "No test session" } }),
  );
  await page.addInitScript(() =>
    sessionStorage.setItem("site-daily-demo", "true"),
  );
  await page.goto("https://siteen.example.test/dashboard");
  await expect(page).toHaveURL("https://siteen.example.test/login");
  await expect(
    page.getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("หรือเริ่มสำรวจการทำงาน", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("ไม่ต้องสมัคร • ข้อมูลทดลองเก็บเฉพาะเบราว์เซอร์นี้", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "เข้าสู่ระบบด้วย Google", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("site-daily-demo")),
  ).toBeNull();
  await page.screenshot({
    path: "test-results/qa/public-login-without-demo.png",
    fullPage: true,
  });
});

test("localhost keeps the sample workflow and can resume its saved session", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" })
    .click();
  await expect(
    page.getByRole("heading", { name: "ภาพรวมหน้างาน" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(
      "กำลังทดลองด้วยข้อมูลตัวอย่าง • ข้อมูลและรูปเก็บในเบราว์เซอร์นี้เท่านั้น",
    ),
  ).toBeVisible();
});
