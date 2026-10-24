// Explicit opt-in only. Run with node --env-file=.env.local tests/live-integration.mjs.
// SDTH_TEST_USERS_FILE points to a PRIVATE JSON file with [{email,password}].
// Never commit that file. Creates labeled DEV test data and removes uploaded files.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { updateLiveDocument } from "./live-document-write.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (url !== "https://hvcwskmqwvrjsrysllly.supabase.co")
  throw new Error("Refusing to test any project except SITE DAILY TH DEV");
if (!process.env.SDTH_TEST_USERS_FILE || !process.env.SDTH_TEST_RESULT_FILE)
  throw new Error("Private credential and result file paths required");
const users = JSON.parse(
  readFileSync(process.env.SDTH_TEST_USERS_FILE, "utf8"),
);
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const ok = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const checks = [];
const fixtures = [];
const clients = [];
try {
  if (users.length !== 2 && !process.argv.includes("--single-account")) {
    throw new Error(
      "Two registered, email-confirmed accounts are required for the complete isolation test",
    );
  }
  for (const user of users) {
    const c = client();
    const login = ok(
      await c.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      }),
    );
    assert.ok(login.session);
    checks.push("Password login: " + user.email);
    clients.push(c);
  }
  assert.ok(clients.length, "No registered test account");
  for (const [index, a] of clients.entries()) {
    const workspace = ok(
      await a.rpc("create_workspace", {
        workspace_name: "DEV INTEGRATION TEST " + new Date().toISOString(),
      }),
    );
    const fixture = { workspace };
    fixtures.push(fixture);
    const project = ok(
      await a
        .from("projects")
        .insert({
          workspace_id: workspace,
          name: "โครงการทดสอบบริการจริง",
          location: "DEV ONLY",
          client: "บัญชีทดสอบ",
        })
        .select()
        .single(),
    );
    const identity = ok(await a.auth.getUser()).user.id;
    const report = ok(
      await a
        .from("daily_reports")
        .insert({
          workspace_id: workspace,
          project_id: project.id,
          report_date: new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Bangkok",
          }).format(new Date()),
          weather: "แดดออก",
          workers: 2,
          work_done: "ทดสอบ Login, RLS และ Storage ผ่านบริการจริง",
          materials: "ข้อความวัสดุเดิมทดสอบ",
          equipment: "ข้อความเครื่องมือเดิมทดสอบ",
          tomorrow: "แผนเดิมทดสอบ",
          report_details: {
            version: 1,
            meta: {},
            labor: [],
            equipment: [],
            progress: [],
            material_rows: [
              {
                label: "คอนกรีตทดสอบ",
                kind: "received",
                quantity: 12.5,
                unit: "ลบ.ม.",
                notes: "DEV ONLY",
              },
            ],
          },
          created_by: identity,
        })
        .select()
        .single(),
    );
    const materialRead = ok(
      await a.from("daily_reports").select("*").eq("id", report.id).single(),
    );
    assert.equal(materialRead.report_details.material_rows[0].quantity, 12.5);
    assert.equal(materialRead.materials, "ข้อความวัสดุเดิมทดสอบ");
    assert.equal(materialRead.equipment, "ข้อความเครื่องมือเดิมทดสอบ");
    assert.equal(materialRead.tomorrow, "แผนเดิมทดสอบ");
    const invalidMaterial = await updateLiveDocument(
      a,
      "daily_reports",
      materialRead,
      {
        report_details: {
          ...materialRead.report_details,
          material_rows: [
            { ...materialRead.report_details.material_rows[0], quantity: -1 },
          ],
        },
      },
    );
    assert.equal(
      invalidMaterial.error?.code,
      "23514",
      "Must reach structured material validation, not a version conflict",
    );
    assert.match(invalidMaterial.error.message, /valid_report_material_rows/);
    checks.push(
      "Structured material quantity and legacy text roundtrip, invalid quantity denied",
    );
    assert.equal(
      ok(
        await a
          .from("projects")
          .update({ location: "DEV OWNER UPDATE" })
          .eq("id", project.id)
          .select()
          .single(),
      ).location,
      "DEV OWNER UPDATE",
    );
    const updatedReport = ok(
      await updateLiveDocument(a, "daily_reports", materialRead, { workers: 3 })
        .select()
        .single(),
    );
    assert.equal(updatedReport.workers, 3);
    assert.equal(updatedReport.row_version, materialRead.row_version + 1);
    const staleUpdate = await updateLiveDocument(
      a,
      "daily_reports",
      materialRead,
      { workers: 999 },
    );
    assert.equal(
      staleUpdate.error?.code,
      "40001",
      "Stale document edits must be rejected",
    );
    const afterConflict = ok(
      await a
        .from("daily_reports")
        .select("workers,row_version")
        .eq("id", report.id)
        .single(),
    );
    assert.equal(afterConflict.workers, 3);
    assert.equal(afterConflict.row_version, updatedReport.row_version);
    checks.push(
      "Report expected_version increments; stale snapshot rejected without overwriting saved data",
    );
    checks.push(
      `Company ${index + 1}: owner project/report create, read and update`,
    );
    const id = randomUUID(),
      path = `${workspace}/${project.id}/${report.id}/${id}.png`;
    fixture.object = path;
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jwH8AAAAASUVORK5CYII=",
      "base64",
    );
    ok(
      await a.storage
        .from("site-photos")
        .upload(path, bytes, { contentType: "image/png", upsert: false }),
    );
    ok(
      await a.from("photos").insert({
        id,
        workspace_id: workspace,
        project_id: project.id,
        report_id: report.id,
        path,
        caption: "รูปทดสอบบริการจริง",
      }),
    );
    const downloaded = ok(await a.storage.from("site-photos").download(path));
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
    const signed = ok(
      await a.storage.from("site-photos").createSignedUrl(path, 60),
    );
    const response = await fetch(signed.signedUrl);
    assert.equal(response.status, 200);
    assert.equal((await response.arrayBuffer()).byteLength, bytes.length);
    checks.push(
      "Authenticated image upload, metadata, download and signed URL",
    );
    const anon = client();
    assert.ok(
      (await anon.from("projects").select("*").eq("id", project.id)).error,
    );
    assert.ok((await anon.storage.from("site-photos").download(path)).error);
    checks.push("Anonymous Data API and private file access denied");
    if (clients[1]) {
      const b = clients[1 - index];
      assert.deepEqual(
        ok(await b.from("projects").select("*").eq("id", project.id)),
        [],
      );
      assert.deepEqual(
        ok(await b.from("daily_reports").select("*").eq("id", report.id)),
        [],
      );
      assert.deepEqual(ok(await b.from("photos").select("*").eq("id", id)), []);
      assert.deepEqual(
        ok(await b.from("workspaces").select("id").eq("id", workspace)),
        [],
      );
      assert.deepEqual(
        ok(
          await b
            .from("memberships")
            .select("user_id")
            .eq("workspace_id", workspace),
        ),
        [],
      );
      assert.ok(
        (
          await b.from("memberships").insert({
            workspace_id: workspace,
            user_id: ok(await b.auth.getUser()).user.id,
            role: "owner",
          })
        ).error,
      );
      assert.deepEqual(
        ok(
          await b
            .from("projects")
            .update({ location: "FOREIGN UPDATE" })
            .eq("id", project.id)
            .select("id"),
        ),
        [],
      );
      assert.ok(
        (
          await b.from("daily_reports").insert({
            workspace_id: workspace,
            project_id: project.id,
            report_date: "2026-10-22",
            weather: "แดดออก",
            work_done: "must deny",
            created_by: ok(await b.auth.getUser()).user.id,
          })
        ).error,
      );
      assert.deepEqual(
        ok(await b.from("photos").delete().eq("id", id).select("id")),
        [],
      );
      assert.equal(
        ok(await a.from("photos").select("id").eq("id", id).single()).id,
        id,
      );
      assert.ok(
        (
          await b
            .from("projects")
            .insert({ workspace_id: workspace, name: "must deny" })
        ).error,
      );
      assert.deepEqual(
        ok(
          await updateLiveDocument(b, "daily_reports", updatedReport, {
            workers: 999,
          }).select("id"),
        ),
        [],
      );
      const forgedId = randomUUID();
      assert.ok(
        (
          await b.from("photos").insert({
            id: forgedId,
            workspace_id: workspace,
            project_id: project.id,
            report_id: report.id,
            path: `${workspace}/${project.id}/${report.id}/${forgedId}.png`,
          })
        ).error,
      );
      assert.ok((await b.storage.from("site-photos").download(path)).error);
      assert.ok(
        (await b.storage.from("site-photos").createSignedUrl(path, 60)).error,
      );
      assert.ok(
        (
          await b.storage
            .from("site-photos")
            .upload(
              `${workspace}/${project.id}/${report.id}/${randomUUID()}.png`,
              bytes,
              { contentType: "image/png" },
            )
        ).error,
      );
      assert.ok(
        (
          await b.storage
            .from("site-photos")
            .update(path, Buffer.from("foreign overwrite"), {
              contentType: "image/png",
            })
        ).error,
      );
      await b.storage.from("site-photos").remove([path]);
      assert.equal(
        ok(
          await a
            .from("projects")
            .select("location")
            .eq("id", project.id)
            .single(),
        ).location,
        "DEV OWNER UPDATE",
      );
      assert.equal(
        ok(
          await a
            .from("daily_reports")
            .select("workers")
            .eq("id", report.id)
            .single(),
        ).workers,
        3,
      );
      assert.equal(
        ok(
          await a.storage
            .from("site-photos")
            .list(`${workspace}/${project.id}/${report.id}`, {
              search: `${id}.png`,
            }),
        ).filter((x) => x.name === `${id}.png`).length,
        1,
      );
      assert.deepEqual(
        Buffer.from(
          await ok(
            await a.storage.from("site-photos").download(path),
          ).arrayBuffer(),
        ),
        bytes,
      );
      checks.push(
        `Company ${index + 1}: other real account denied row reads/writes, signed URL, file download/upload/deletion; owner file survives`,
      );
    }
    ok(await a.storage.from("site-photos").remove([path]));
    ok(await a.from("photos").delete().eq("id", id));
    assert.deepEqual(
      ok(
        await a.storage
          .from("site-photos")
          .list(`${workspace}/${project.id}/${report.id}`),
      ),
      [],
    );
    assert.ok(
      (await a.storage.from("site-photos").createSignedUrl(path, 60)).error,
    );
    assert.deepEqual(ok(await a.from("photos").select("id").eq("id", id)), []);
    checks.push("Storage and photo metadata deletion");
  }
  writeFileSync(
    process.env.SDTH_TEST_RESULT_FILE,
    JSON.stringify(
      {
        status: "passed",
        crossTenantHTTP: clients.length > 1,
        checks,
        fixtures,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        status: "passed",
        crossTenantHTTP: clients.length > 1,
        checks,
        fixtures,
      },
      null,
      2,
    ),
  );
} catch (e) {
  writeFileSync(
    process.env.SDTH_TEST_RESULT_FILE,
    JSON.stringify(
      { status: "incomplete", checks, fixtures, error: e.message },
      null,
      2,
    ),
  );
  console.error(e.message);
  process.exitCode = 1;
} finally {
  for (const c of clients) await c.auth.signOut({ scope: "local" });
}
process.exit(process.exitCode || 0);
