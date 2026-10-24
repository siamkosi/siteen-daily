import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { installPdfExportFixture } from "./pdf-fixture";
import type { Photo, Report } from "../src/lib/types";
import { emptyStorageTotals, storageMetrics } from "../src/lib/storage-usage";

test("new photos are resized, EXIF oriented, previewed separately and printed at full resolution", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/login");
  await page
    .getByRole("button", { name: "ทดลองใช้งานด้วยข้อมูลตัวอย่าง" })
    .click();
  await page.goto("/reports");
  await page
    .getByRole("link", { name: /เปิดรายงาน 20/ })
    .first()
    .click();
  await page.getByLabel("เลือกรูปภาพ", { exact: true }).setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not an image"),
  });
  await page
    .getByRole("button", { name: "อัปโหลดรูปภาพ", exact: true })
    .click();
  await expect(page.locator('.error[role="alert"]')).toContainText("อ่านรูป");
  await page
    .getByLabel("เลือกรูปภาพ", { exact: true })
    .setInputFiles([
      "tests/fixtures/photo-4000x3000.jpg",
      "tests/fixtures/photo-oriented.jpg",
    ]);
  await page
    .getByLabel("คำบรรยาย", { exact: true })
    .fill("ทดสอบความชัดของรูปใน PDF — ข้อมูลสมมติ");
  await page
    .getByRole("button", { name: "อัปโหลดรูปภาพ", exact: true })
    .click();
  await expect(page.locator(".photo-grid img")).toHaveCount(2);
  const saved = await page.evaluate(async () => {
    const data = JSON.parse(localStorage.getItem("site-daily-th:demo:v1")!);
    return Promise.all(
      data.photos.map(async (p: Photo) => {
        const preview = await createImageBitmap(
          await (await fetch(p.thumbnail_url!)).blob(),
        );
        const dimensions = [preview.width, preview.height];
        preview.close();
        return { ...p, previewDimensions: dimensions };
      }),
    );
  });
  expect(saved[0].image_width).toBe(2560);
  expect(saved[0].image_height).toBe(1920);
  expect(saved[0].previewDimensions).toEqual([640, 480]);
  expect(saved[0].byte_size).toBeLessThan(saved[0].source_byte_size);
  expect(saved[0].thumbnail_byte_size).toBeLessThan(saved[0].byte_size);
  expect([saved[1].image_width, saved[1].image_height]).toEqual([800, 1200]);
  expect(saved[1].previewDimensions).toEqual([427, 640]);
  await writeFile(
    "output/qa/optimized-photo.jpg",
    Buffer.from(saved[0].url.split(",")[1], "base64"),
  );
  await writeFile(
    "output/qa/preview-photo.jpg",
    Buffer.from(saved[0].thumbnail_url.split(",")[1], "base64"),
  );
  await writeFile(
    "output/qa/photo-preparation.json",
    JSON.stringify(
      saved.map((p) => ({
        width: p.image_width,
        height: p.image_height,
        bytes: p.byte_size,
        previewBytes: p.thumbnail_byte_size,
        sourceBytes: p.source_byte_size,
      })),
      null,
      2,
    ),
  );
  await expect(page.locator(".photo-grid img").first()).toHaveAttribute(
    "src",
    saved[0].thumbnail_url,
  );
  await expect(
    page.locator(".print-report .dr-photo-image img").first(),
  ).toHaveAttribute("src", saved[0].url);
  await installPdfExportFixture(page);
  let usesPrintImages = false;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/reports/pdf")) {
      const html = request.postDataJSON().html as string;
      usesPrintImages =
        html.includes(saved[0].url) && !html.includes(saved[0].thumbnail_url);
    }
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "ส่งออก PDF", exact: true }).click();
  await (await download).saveAs("output/pdf/photo-quality.pdf");
  expect(usesPrintImages).toBe(true);
  await page.goto("/photos");
  await expect(page.locator(".gallery-card")).toHaveCount(2);
  await expect(page.locator(".gallery-card img").first()).toHaveAttribute(
    "src",
    saved[1].thumbnail_url,
  );
  await page.screenshot({
    path: "output/qa/photo-gallery-previews.png",
    fullPage: false,
  });
});

const userId = "10000000-0000-4000-8000-000000000001",
  workspace = "20000000-0000-4000-8000-000000000001";
const projects = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
];
const reports = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
];
async function photoApi(page: Page, role: "editor" | "viewer", count = 30) {
  const user = {
    id: userId,
    email: "photos@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
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
  const documents: Report[] = reports.map((id, i) => ({
    id,
    workspace_id: workspace,
    project_id: projects[i],
    report_date: i ? "2026-10-22" : "2026-10-24",
    weather: "ยังไม่บันทึก",
    workers: 0,
    work_done: "QA photo report",
    materials: "",
    equipment: "",
    issues: "",
    tomorrow: "",
    status: "draft",
    created_by: userId,
    created_at: "2026-10-24T00:00:00Z",
    updated_at: "2026-10-24T00:00:00Z",
  }));
  const state = {
    rows: [] as Photo[],
    allowedProjects: [...projects],
    queries: [] as URL[],
    signed: [] as string[][],
    removed: [] as string[][],
    uploaded: [] as { path: string; bytes: number }[],
    mode: "ok",
    failRead: false,
    usageReads: 0,
    projectReads: 0,
    coverPath: null as string | null,
    coverSigns: 0,
    downloads: [] as string[],
    holdRead: null as Promise<void> | null,
    completedReads: 0,
  };
  state.rows = Array.from({ length: count }, (_, i) => {
    const j = i < 18 ? 0 : 1,
      id = `50000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      base = `${workspace}/${projects[j]}/${reports[j]}/${id}`;
    return {
      id,
      workspace_id: workspace,
      project_id: projects[j],
      report_id: reports[j],
      path: `${base}.jpeg`,
      thumbnail_path: i === 0 ? null : `${base}.thumb.jpeg`,
      caption: `QA photo ${i + 1}`,
      created_at: `2026-10-24T00:00:${String(59 - i).padStart(2, "0")}Z`,
    };
  });
  const jpeg = await readFile("public/report-logos/27-engineering.jpg");
  await page.route("**/auth/v1/user", (route) => route.fulfill({ json: user }));
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.endsWith("/project_memberships"))
      return route.fulfill({
        json: projects
          .filter((id) => state.allowedProjects.includes(id))
          .map((id) => ({
            workspace_id: workspace,
            user_id: userId,
            project_id: id,
            role,
            row_version: 1,
          })),
      });
    if (url.pathname.endsWith("/memberships"))
      return route.fulfill({
        json: [
          {
            workspace_id: workspace,
            role: "member",
            workspaces: { id: workspace, name: "Photo QA — ข้อมูลสมมติ" },
          },
        ],
      });
    if (url.pathname.endsWith("/projects")) {
      state.projectReads++;
      return route.fulfill({
        json: projects
          .filter((id) => state.allowedProjects.includes(id))
          .map((id, i) => ({
            id,
            workspace_id: workspace,
            name: `QA project ${i + 1}`,
            location: "DEV",
            client: "QA",
            status: "active",
            created_at: "2026-10-24T00:00:00Z",
            cover_path: i === 0 ? state.coverPath : null,
          })),
      });
    }
    if (url.pathname.endsWith("/daily_reports"))
      return route.fulfill({
        json: documents.filter((r) =>
          state.allowedProjects.includes(r.project_id),
        ),
      });
    if (url.pathname.endsWith("/rpc/company_photo_storage")) {
      state.usageReads++;
      const usage = projects.map((id, i) => {
        const rows = state.rows.filter((p) => p.project_id === id),
          total = emptyStorageTotals();
        for (const p of rows) {
          total.photo_count++;
          total.total_files += p.thumbnail_path ? 2 : 1;
          total.report_bytes += p.byte_size ?? 0;
          total.thumbnail_bytes += p.thumbnail_byte_size ?? 0;
          total.total_bytes +=
            (p.byte_size ?? 0) + (p.thumbnail_byte_size ?? 0);
          if (p.byte_size == null) total.unknown_files++;
        }
        return {
          ...total,
          project_id: id,
          project_name: `QA project ${i + 1}`,
          project_status: "active",
        };
      });
      const total = emptyStorageTotals();
      for (const row of usage)
        for (const key of storageMetrics) total[key] += row[key];
      return route.fulfill({
        json: {
          workspace_id: workspace,
          quota_bytes: null,
          warning_percent: 80,
          critical_percent: 95,
          checked_at: new Date().toISOString(),
          projects: usage,
          totals: total,
        },
      });
    }
    if (!url.pathname.endsWith("/photos")) return route.fulfill({ json: [] });
    expect(url.searchParams.get("workspace_id") || `eq.${workspace}`).toBe(
      `eq.${workspace}`,
    );
    if (request.method() === "POST") {
      expect(role).toBe("editor");
      if (state.mode === "metadata")
        return route.fulfill({
          status: 500,
          json: { message: "QA metadata failed" },
        });
      const photo = request.postDataJSON() as Photo;
      expect(photo.image_width).toBe(2560);
      expect(photo.image_height).toBe(1920);
      expect(photo.byte_size!).toBeLessThan(photo.source_byte_size!);
      expect(photo.thumbnail_byte_size!).toBeLessThan(photo.byte_size!);
      state.rows.push(photo);
      return route.fulfill({ json: [] });
    }
    if (request.method() === "DELETE") {
      expect(role).toBe("editor");
      state.rows = state.rows.filter(
        (p) => `eq.${p.id}` !== url.searchParams.get("id"),
      );
      return route.fulfill({ json: [] });
    }
    state.queries.push(url);
    if (state.failRead)
      return route.fulfill({
        status: 500,
        json: { message: "QA photo query unavailable" },
      });
    let rows = state.rows.filter((p) =>
      state.allowedProjects.includes(p.project_id),
    );
    const gallery = url.searchParams.get("select")!.includes("daily_reports");
    if (gallery) {
      expect(url.searchParams.get("daily_reports.deleted_at")).toBe("is.null");
      expect(url.searchParams.get("daily_reports.status")).toBe(
        "neq.cancelled",
      );
      expect(url.searchParams.get("limit")).toBe("25");
      expect(url.searchParams.get("order")).toBe("created_at.desc,id.desc");
      if (url.searchParams.has("project_id"))
        rows = rows.filter(
          (p) => `eq.${p.project_id}` === url.searchParams.get("project_id"),
        );
      for (const filter of url.searchParams.getAll(
        "daily_reports.report_date",
      )) {
        const [operator, date] = filter.split(".");
        rows = rows.filter((p) =>
          operator === "gte"
            ? documents.find((r) => r.id === p.report_id)!.report_date >= date
            : documents.find((r) => r.id === p.report_id)!.report_date <= date,
        );
      }
    } else {
      expect(url.searchParams.has("report_id")).toBe(true); // No whole-company read.
      expect(Number(url.searchParams.get("limit"))).toBeLessThanOrEqual(100);
      rows = rows.filter(
        (p) => `eq.${p.report_id}` === url.searchParams.get("report_id"),
      );
    }
    const offset = Number(url.searchParams.get("offset") || 0),
      limit = Number(url.searchParams.get("limit"));
    if (state.holdRead) await state.holdRead;
    state.completedReads++;
    return route.fulfill({
      json: rows.slice(offset, offset + limit).map((p) =>
        gallery
          ? {
              ...p,
              daily_reports: documents.find((r) => r.id === p.report_id),
            }
          : p,
      ),
    });
  });
  await page.route("**/storage/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() === "GET") {
      state.downloads.push(request.url());
      return route.fulfill({ body: jpeg, contentType: "image/jpeg" });
    }
    if (
      url.pathname.includes("/object/sign/project-covers/") &&
      request.method() === "POST"
    ) {
      state.coverSigns++;
      return route.fulfill({
        json: {
          signedURL: `${url.pathname.replace("/storage/v1", "")}?token=cover-${state.coverSigns}`,
        },
      });
    }
    if (url.pathname.endsWith("/object/sign/site-photos")) {
      const paths = request.postDataJSON().paths as string[];
      expect(paths.every((p) => p.startsWith(workspace + "/"))).toBe(true);
      state.signed.push(paths);
      expect(request.postDataJSON().expiresIn).toBe(3600);
      if (state.mode === "signing")
        return route.fulfill({
          status: 403,
          json: { message: "QA signing denied" },
        });
      return route.fulfill({
        json: paths.map((path) => ({
          path,
          signedURL: `/object/sign/site-photos/${path}?token=qa-${state.signed.length}`,
        })),
      });
    }
    expect(role).toBe("editor");
    if (request.method() === "DELETE") {
      state.removed.push(request.postDataJSON().prefixes);
      return route.fulfill({ json: [] });
    }
    const path = decodeURIComponent(
      url.pathname.split("/object/site-photos/")[1],
    );
    if (state.mode === "thumbnail" && path.endsWith(".thumb.jpeg"))
      return route.fulfill({
        status: 500,
        json: { statusCode: "500", error: "QA thumbnail failed" },
      });
    state.uploaded.push({ path, bytes: request.postDataBuffer()!.length });
    return route.fulfill({ json: { Key: `site-photos/${path}` } });
  });
  return state;
}

test("gallery uses bounded server pages, legacy fallback and inclusive project/report-date filters", async ({
  page,
}) => {
  const state = await photoApi(page, "viewer");
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "ภาพรวมหน้างาน", exact: true }),
  ).toBeVisible();
  expect(state.queries).toHaveLength(0);
  await page.getByRole("link", { name: "รูปภาพหน้างาน", exact: true }).click();
  await expect(page.locator(".gallery-card")).toHaveCount(24);
  expect(state.signed.at(-1)).toHaveLength(24);
  expect(state.signed.at(-1)![0].endsWith(".thumb.jpeg")).toBe(false);
  expect(
    state.signed
      .at(-1)!
      .slice(1)
      .every((p) => p.endsWith(".thumb.jpeg")),
  ).toBe(true);
  await page.getByRole("button", { name: "หน้าถัดไป", exact: true }).click();
  await expect(page.locator(".gallery-card")).toHaveCount(6);
  expect(state.queries.at(-1)!.searchParams.get("offset")).toBe("24");
  await page
    .getByRole("combobox", { name: "โครงการ", exact: true })
    .selectOption(projects[1]);
  await expect(page.locator(".gallery-card")).toHaveCount(12);
  await expect(
    page.getByRole("navigation", { name: "เปลี่ยนหน้ารูปภาพ" }),
  ).toContainText("หน้า 1");
  await page
    .getByLabel("วันที่รายงาน ตั้งแต่", { exact: true })
    .fill("2026-10-22");
  await page.getByLabel("วันที่รายงาน ถึง", { exact: true }).fill("2026-10-22");
  await expect(page.locator(".gallery-card")).toHaveCount(12);
  await expect
    .poll(() =>
      state.queries.at(-1)!.searchParams.getAll("daily_reports.report_date"),
    )
    .toEqual(["gte.2026-10-22", "lte.2026-10-22"]);
  await page
    .getByLabel("วันที่รายงาน ตั้งแต่", { exact: true })
    .fill("2026-10-23");
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "วันที่เริ่มต้น",
  );
  await expect(page.locator(".gallery-card")).toHaveCount(0);
  await page.getByLabel("วันที่รายงาน ถึง", { exact: true }).fill("2026-10-24");
  await expect(
    page.getByText("ไม่พบรูปตามโครงการและช่วงวันที่ที่เลือก", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("วันที่รายงาน ตั้งแต่", { exact: true })
    .fill("2026-10-22");
  await expect(page.locator(".gallery-card")).toHaveCount(12);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/qa/photo-gallery-filter-mobile.png",
    fullPage: false,
  });
});

test("report photos retry safely and roll back both image variants on failed uploads", async ({
  page,
}) => {
  test.setTimeout(90000);
  const state = await photoApi(page, "editor", 0);
  state.failRead = true;
  await page.goto(`/reports/${reports[0]}`);
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "โหลดรูปแนบไม่สำเร็จ",
  );
  await expect(
    page.getByRole("button", { name: "ส่งออก PDF", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".print-report")).toHaveCount(0);
  state.failRead = false;
  await page
    .getByRole("button", { name: "ลองโหลดรูปแนบใหม่", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "ส่งออก PDF", exact: true }),
  ).toBeEnabled();
  state.mode = "thumbnail";
  await page
    .getByLabel("เลือกรูปภาพ", { exact: true })
    .setInputFiles("tests/fixtures/photo-4000x3000.jpg");
  await page
    .getByRole("button", { name: "อัปโหลดรูปภาพ", exact: true })
    .click();
  await expect(page.locator('.error[role="alert"]')).toBeVisible();
  await expect.poll(() => state.removed.length).toBe(1);
  expect(state.removed[0]).toHaveLength(1);
  expect(state.rows).toHaveLength(0);
  state.mode = "metadata";
  await page
    .getByRole("button", { name: "อัปโหลดรูปภาพ", exact: true })
    .click();
  await expect.poll(() => state.removed.length).toBe(2);
  expect(state.removed[1]).toHaveLength(2);
  expect(state.rows).toHaveLength(0);
  state.mode = "ok";
  const readsBeforeSuccess = state.usageReads;
  await expect(
    page.getByRole("button", { name: "อัปโหลดรูปภาพ", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "อัปโหลดรูปภาพ", exact: true })
    .click();
  await expect(page.locator(".photo-grid img")).toHaveCount(1, {
    timeout: 20000,
  });
  expect(state.rows).toHaveLength(1);
  expect(state.usageReads).toBe(readsBeforeSuccess); // Members never request company totals.
  await expect(page.locator(".photo-grid img")).toHaveAttribute(
    "src",
    /\.thumb\.jpeg/,
  );
  await expect(
    page.locator(".print-report .dr-photo-image img"),
  ).toHaveAttribute("src", new RegExp(`${state.rows[0].id}\\.jpeg`));
  expect(
    state.queries.every(
      (u) => u.searchParams.get("report_id") === `eq.${reports[0]}`,
    ),
  ).toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "ลบรูป", exact: true }).click();
  await expect(page.locator(".photo-grid img")).toHaveCount(0);
  expect(state.removed.at(-1)).toHaveLength(2);
  expect(state.rows).toHaveLength(0);
});

test("signed gallery previews renew on timer and resume without resetting page or filters", async ({
  page,
}) => {
  await page.clock.install();
  const state = await photoApi(page, "viewer");
  await page.goto("/photos");
  await expect(page.locator(".gallery-card")).toHaveCount(24);
  await page.getByRole("button", { name: "หน้าถัดไป", exact: true }).click();
  await expect(page.locator(".gallery-card")).toHaveCount(6);
  const before = state.signed.length;
  await page.clock.fastForward(55 * 60 * 1000);
  await expect.poll(() => state.signed.length).toBe(before + 1);
  await expect(page.locator(".gallery-card img").first()).toHaveAttribute(
    "src",
    new RegExp(`token=qa-${before + 1}$`),
  );
  expect(state.signed.at(-1)).toHaveLength(6);
  expect(state.queries.at(-1)!.searchParams.get("offset")).toBe("24");
  await expect(
    page.getByRole("navigation", { name: "เปลี่ยนหน้ารูปภาพ" }),
  ).toContainText("หน้า 2");
  await page
    .getByRole("combobox", { name: "โครงการ", exact: true })
    .selectOption(projects[1]);
  await page
    .getByLabel("วันที่รายงาน ตั้งแต่", { exact: true })
    .fill("2026-10-22");
  await page.getByLabel("วันที่รายงาน ถึง", { exact: true }).fill("2026-10-22");
  await expect(page.locator(".gallery-card")).toHaveCount(12);
  const filtered = state.signed.length;
  await page.clock.setSystemTime(
    new Date(await page.evaluate(() => Date.now() + 61 * 60 * 1000)),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => state.signed.length).toBe(filtered + 1);
  expect(state.signed.at(-1)).toHaveLength(12);
  expect(
    state.queries.at(-1)!.searchParams.getAll("daily_reports.report_date"),
  ).toEqual(["gte.2026-10-22", "lte.2026-10-22"]);
  await expect(
    page.getByRole("combobox", { name: "โครงการ", exact: true }),
  ).toHaveValue(projects[1]);
  await expect(
    page.getByLabel("วันที่รายงาน ถึง", { exact: true }),
  ).toHaveValue("2026-10-22");
  expect(state.projectReads).toBeGreaterThan(1);
});

test("photo and cover renewal keeps the same unsaved report editor mounted", async ({
  page,
}) => {
  await page.clock.install();
  const state = await photoApi(page, "editor", 2);
  state.coverPath = `${workspace}/${projects[0]}/cover.jpeg`;
  await page.goto(`/reports/${reports[0]}`);
  await expect(page.locator(".photo-grid img")).toHaveCount(2);
  await expect.poll(() => state.coverSigns).toBe(1);
  await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
  const input = page.getByLabel("ชื่อผู้รายงาน", { exact: true });
  await input.fill("QA ยังไม่ได้บันทึก");
  await input.evaluate((el) => {
    el.setAttribute("data-editor-qa", "same-node");
  });
  const before = state.signed.length;
  await page.clock.fastForward(61 * 60 * 1000);
  await expect.poll(() => state.signed.length).toBe(before + 1);
  await expect.poll(() => state.coverSigns).toBe(2);
  await expect(input).toHaveValue("QA ยังไม่ได้บันทึก");
  await expect(input).toHaveAttribute("data-editor-qa", "same-node");
  expect(state.projectReads).toBe(1);
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(page.locator(".photo-grid img").first()).toHaveAttribute(
    "src",
    new RegExp(`token=qa-${before + 1}$`),
  );
  await page.getByRole("link", { name: "ภาพรวม", exact: true }).click();
  await expect
    .poll(async () =>
      (
        await page.locator(".project-cover-photo").getAttribute("src")
      )?.endsWith(`token=cover-${state.coverSigns}`),
    )
    .toBe(true);
});

test("failed renewal removes stale links and retries on reconnection; image error retries are bounded", async ({
  page,
}) => {
  await page.clock.install();
  const state = await photoApi(page, "viewer", 2);
  await page.goto("/photos");
  await expect(page.locator(".gallery-card")).toHaveCount(2);
  const before = state.signed.length;
  await page.locator(".gallery-card img").evaluateAll((imgs) => {
    for (let i = 0; i < 10; i++)
      for (const img of imgs) img.dispatchEvent(new Event("error"));
  });
  await expect.poll(() => state.signed.length).toBe(before + 1);
  await page.locator(".gallery-card img").first().dispatchEvent("error");
  expect(state.signed).toHaveLength(before + 1);
  state.mode = "signing";
  await page.clock.fastForward(55 * 60 * 1000);
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "ลิงก์รูปไม่สำเร็จ",
  );
  await expect(page.locator(".gallery-card")).toHaveCount(0);
  await page.clock.fastForward(30000);
  await expect.poll(() => state.signed.length).toBe(before + 3);
  state.mode = "ok";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".gallery-card")).toHaveCount(2);
  expect(state.signed).toHaveLength(before + 4);
});

test("PDF signs full-size photos afresh after a suspended hour and embeds them before calling API", async ({
  page,
}) => {
  await page.clock.install();
  const state = await photoApi(page, "viewer", 2);
  const requests: { html: string; document: { id: string } }[] = [];
  await page.route("**/api/reports/pdf", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      body: Buffer.from("%PDF-1.7\n%%EOF"),
      contentType: "application/pdf",
    });
  });
  await page.goto(`/reports/${reports[0]}`);
  await expect(page.locator(".print-report .dr-photo-image img")).toHaveCount(
    2,
  );
  const before = state.signed.length;
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    }),
  );
  await page.clock.fastForward(61 * 60 * 1000);
  expect(state.signed).toHaveLength(before);
  await page.getByRole("button", { name: "ส่งออก PDF", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(state.signed).toHaveLength(before + 1);
  expect(state.signed.at(-1)).toEqual(state.rows.map((p) => p.path));
  const embedded = await page.evaluate(
    (html) =>
      Array.from(
        new DOMParser()
          .parseFromString(html, "text/html")
          .querySelectorAll<HTMLImageElement>("img[data-photo-path]"),
      ).map((img) => ({ src: img.src, path: img.dataset.photoPath })),
    requests[0].html,
  );
  expect(embedded).toHaveLength(2);
  expect(
    embedded.every((img) => img.src.startsWith("data:image/jpeg;base64,")),
  ).toBe(true);
  expect(embedded.map((img) => img.path)).toEqual(
    state.rows.map((p) => p.path),
  );
  expect(
    state.downloads.filter(
      (url) =>
        url.endsWith(`token=qa-${before + 1}`) && !url.includes(".thumb.jpeg"),
    ),
  ).toHaveLength(2);
  expect(requests[0].html).not.toContain("?token=");
  expect(requests[0].document.id).toBe(reports[0]);
  state.mode = "signing";
  await expect(
    page.getByRole("button", { name: "ส่งออก PDF", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "ส่งออก PDF", exact: true }).click();
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "QA signing denied",
  );
  expect(requests).toHaveLength(1); // Never export a document with missing photos.
  state.mode = "ok";
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => state.signed.length).toBeGreaterThan(before + 2);
  await expect(page.locator(".print-report .dr-photo-image img")).toHaveCount(
    2,
  );
});

test("a delayed renewal cannot replace a newly selected project's photo page", async ({
  page,
}) => {
  await page.clock.install();
  const state = await photoApi(page, "viewer");
  await page.goto("/photos");
  await expect(page.locator(".gallery-card")).toHaveCount(24);
  let release!: () => void;
  state.holdRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reads = state.queries.length;
  await page.clock.fastForward(55 * 60 * 1000);
  await expect.poll(() => state.queries.length).toBe(reads + 1);
  state.holdRead = null;
  await page
    .getByRole("combobox", { name: "โครงการ", exact: true })
    .selectOption(projects[1]);
  await expect(page.locator(".gallery-card")).toHaveCount(12);
  const completed = state.completedReads;
  release();
  await expect.poll(() => state.completedReads).toBe(completed + 1);
  await expect(page.locator(".gallery-card")).toHaveCount(12);
  await expect(page.locator(".gallery-card").first()).toContainText(
    "QA project 2",
  );
  await expect(
    page.getByRole("combobox", { name: "โครงการ", exact: true }),
  ).toHaveValue(projects[1]);
});

test("a photo deletion during renewal queues a fresh read instead of restoring the older snapshot", async ({
  page,
}) => {
  await page.clock.install();
  const state = await photoApi(page, "editor", 2);
  await page.goto(`/reports/${reports[0]}`);
  await expect(page.locator(".photo-grid img")).toHaveCount(2);
  let release!: () => void;
  state.holdRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reads = state.queries.length;
  await page.clock.fastForward(55 * 60 * 1000);
  await expect.poll(() => state.queries.length).toBe(reads + 1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "ลบรูป", exact: true }).last().click();
  await expect.poll(() => state.rows.length).toBe(1);
  await expect(
    page.getByRole("button", { name: "ลบรูป", exact: true }).first(),
  ).toBeEnabled();
  state.holdRead = null;
  release();
  await expect(page.locator(".photo-grid img")).toHaveCount(1);
  expect(state.queries).toHaveLength(reads + 2);
  expect(state.projectReads).toBe(1);
});

test("focus revocation clears cached gallery thumbnails and captions immediately", async ({
  page,
}) => {
  const state = await photoApi(page, "viewer");
  await page.goto("/photos");
  await expect(page.locator(".gallery-card")).toHaveCount(24);
  await expect(page.getByRole("link", { name: /QA photo 1 / })).toBeVisible();
  state.allowedProjects = [projects[1]];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page
      .getByRole("combobox", { name: "โครงการ", exact: true })
      .locator(`option[value="${projects[0]}"]`),
  ).toHaveCount(0);
  await expect(page.locator(".gallery-card")).toHaveCount(12);
  await expect(page.getByRole("link", { name: /QA photo 1 / })).toHaveCount(0);
});
