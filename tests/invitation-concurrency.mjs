// Real multi-connection PostgreSQL in an isolated, disposable Docker container.
// No host ports, volumes, Auth HTTP, SMTP or hosted database access.
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const container = `siteen-invitations-qa-${randomUUID().slice(0, 12)}`;
function run(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let out = "",
      err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("Local Docker command timed out"));
    }, 90000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(Error(err.slice(-1800) || `docker exited ${code}`));
    });
    child.stdin.end(input);
  });
}
const sql = (q) =>
  run(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-qAt",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "VERBOSITY=verbose",
    ],
    q,
  );
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [o1, o2, o3, o4, u1, u2, u3] = [1, 2, 3, 4, 5, 6, 7].map(id),
  [a, b, pa, pb] = [10, 11, 20, 21].map(id);
const as = (user, q) =>
  sql(
    `begin;set local role authenticated;select set_config('request.jwt.claim.sub','${user}',true);${q};commit;`,
  );
const scalar = async (q) => (await sql(q)).trim().split("\n").at(-1);
const parse = (out) => JSON.parse(out.trim().split("\n").at(-1));
const prepare = (
  company,
  project,
  email,
  request = randomUUID(),
  existing = "null",
  version = "null",
) =>
  `select public.prepare_company_invitation('${company}','${email}',array['${project}'::uuid],'editor','${request}',${existing},${version})`;
let checks = 0;
try {
  await run([
    "run",
    "-d",
    "--rm",
    "--network",
    "none",
    "--name",
    container,
    "-e",
    "POSTGRES_PASSWORD=isolated-local-test-only",
    "postgres:17-alpine",
  ]);
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await run([
        "exec",
        container,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
      ]);
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  assert.ok(ready, "Local PostgreSQL ready");
  await sql(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb);
 alter table storage.objects enable row level security;grant usage on schema public,storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
  await sql(
    readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
      .join("\n"),
  );
  await sql(`insert into auth.users(id,email,email_confirmed_at) values ${[o1, o2, o3, o4, u1, u2, u3].map((u, i) => `('${u}','user${i + 1}@example.test',now())`).join(",")};
 insert into public.workspaces(id,name) values('${a}','Concurrency A'),('${b}','Concurrency B');
 insert into public.memberships values('${a}','${o1}','owner'),('${a}','${o2}','owner'),('${a}','${o3}','owner'),('${a}','${o4}','owner'),('${b}','${o1}','owner');
 insert into public.projects(id,workspace_id,name) values('${pa}','${a}','Project A'),('${pb}','${b}','Project B');`);
  const offer = parse(await as(o1, prepare(a, pa, "user5@example.test")));
  const accept = `select public.accept_company_invitation('${offer.id}',1)`;
  const repeats = await Promise.all([as(u1, accept), as(u1, accept)]);
  assert.ok(repeats.every((r) => r.includes(a)));
  assert.equal(
    await scalar(
      `select count(*) from public.memberships where workspace_id='${a}' and user_id='${u1}'`,
    ),
    "1",
  );
  checks += 2;
  const race = parse(await as(o1, prepare(a, pa, "user6@example.test")));
  const compete = await Promise.allSettled([
    as(u2, `select public.accept_company_invitation('${race.id}',1)`),
    as(o2, `select public.cancel_company_invitation('${a}','${race.id}',1)`),
  ]);
  assert.equal(compete.filter((r) => r.status === "fulfilled").length, 1);
  const status = await scalar(
    `select status from private.company_invitations where id='${race.id}'`,
  );
  assert.equal(
    await scalar(
      `select count(*) from public.project_memberships where workspace_id='${a}' and user_id='${u2}'`,
    ),
    status === "accepted" ? "1" : "0",
  );
  checks += 2;
  const resend = parse(await as(o1, prepare(a, pa, "user7@example.test")));
  await sql(
    `update private.invitation_send_attempts set created_at=now()-interval '2 minutes' where invitation_id='${resend.id}'`,
  );
  await Promise.allSettled([
    as(
      o1,
      prepare(a, pa, "user7@example.test", randomUUID(), `'${resend.id}'`, 1),
    ),
    as(o2, `select public.cancel_company_invitation('${a}','${resend.id}',1)`),
  ]);
  assert.equal(
    await scalar(
      `select status from private.company_invitations where id='${resend.id}'`,
    ),
    "cancelled",
  );
  await assert.rejects(
    as(u3, `select public.accept_company_invitation('${resend.id}',1)`),
  );
  checks += 2;
  // Two Owners cannot overwrite the same assignment snapshot.
  const roles = await Promise.allSettled([
    as(
      o1,
      `select public.set_project_assignment('${a}','${pa}','${u1}','viewer',1,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${a}')) m where m->>'user_id'='${u1}'))`,
    ),
    as(
      o2,
      `select public.set_project_assignment('${a}','${pa}','${u1}',null,1,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${a}')) m where m->>'user_id'='${u1}'))`,
    ),
  ]);
  assert.equal(roles.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(
    roles.some(
      (r) => r.status === "rejected" && r.reason.message.includes("40001"),
    ),
  );
  checks += 2;
  // Removal and assignment updates serialize on the company lock; stale previews never win.
  const removePreview = async () =>
    parse(
      await as(
        o1,
        `select public.preview_company_member_removal('${a}','${u1}')`,
      ),
    );
  const removal = await removePreview();
  const removeSql = (s) =>
    `select public.remove_company_member('${a}','${u1}','${s.membership_version}','${s.assignments_hash}')`;
  const removalRace = await Promise.allSettled([
    as(o1, removeSql(removal)),
    as(
      o2,
      `select public.set_project_assignment('${a}','${pa}','${u1}','editor',2,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${a}')) m where m->>'user_id'='${u1}'))`,
    ),
  ]);
  assert.equal(removalRace.filter((r) => r.status === "fulfilled").length, 1);
  checks++;
  if (
    (await scalar(
      `select count(*) from public.memberships where workspace_id='${a}' and user_id='${u1}'`,
    )) === "1"
  )
    await as(o1, removeSql(await removePreview()));
  await assert.rejects(as(u1, accept), (e) => e.message.includes("40001"));
  checks++;
  await sql(
    `update private.invitation_send_attempts set created_at=now()-interval '2 minutes' where invitation_id='${offer.id}'`,
  );
  const reoffer = parse(await as(o1, prepare(a, pa, "user5@example.test")));
  await as(u1, `select public.accept_company_invitation('${reoffer.id}',1)`);
  const rejoined = await removePreview();
  assert.notEqual(removal.membership_version, rejoined.membership_version);
  checks++;
  await assert.rejects(
    as(
      o1,
      removeSql({
        ...rejoined,
        membership_version: removal.membership_version,
      }),
    ),
    (e) => e.message.includes("40001"),
  );
  checks++;
  // Replaying an accepted invitation while removing the member cannot restore access.
  const replayRace = await Promise.allSettled([
    as(o1, removeSql(rejoined)),
    as(u1, `select public.accept_company_invitation('${reoffer.id}',1)`),
  ]);
  assert.equal(replayRace[0].status, "fulfilled");
  assert.equal(
    await scalar(
      `select count(*) from public.memberships where workspace_id='${a}' and user_id='${u1}'`,
    ),
    "0",
  );
  checks += 2;
  await assert.rejects(
    as(u1, `select public.accept_company_invitation('${reoffer.id}',1)`),
    (e) => e.message.includes("40001"),
  );
  checks++;
  // Exact per-Owner cap across two companies with concurrent last-slot attempts.
  await sql(
    `update private.invitation_send_attempts set created_at=now()-interval '2 hours';insert into private.invitation_send_attempts(workspace_id,invitation_id,owner_id,request_id) select '${a}','${offer.id}','${o1}',gen_random_uuid() from generate_series(1,9)`,
  );
  const hourly = await Promise.allSettled([
    as(o1, prepare(a, pa, "owner-limit-a@example.test")),
    as(o1, prepare(b, pb, "owner-limit-b@example.test")),
  ]);
  assert.equal(hourly.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(
    hourly.some(
      (r) => r.status === "rejected" && r.reason.message.includes("P0429"),
    ),
  );
  assert.equal(
    await scalar(
      `select count(*) from private.invitation_send_attempts where owner_id='${o1}' and created_at>now()-interval '1 hour'`,
    ),
    "10",
  );
  checks += 3;
  // Exact company cap with different Owners racing for the final slot.
  await sql(
    `update private.invitation_send_attempts set created_at=now()-interval '2 hours';insert into private.invitation_send_attempts(workspace_id,invitation_id,owner_id,request_id) select '${a}','${offer.id}','${o2}',gen_random_uuid() from generate_series(1,29)`,
  );
  const companyLimit = await Promise.allSettled([
    as(o3, prepare(a, pa, "company-limit-a@example.test")),
    as(o4, prepare(a, pa, "company-limit-b@example.test")),
  ]);
  assert.equal(companyLimit.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await scalar(
      `select count(*) from private.invitation_send_attempts where workspace_id='${a}' and created_at>now()-interval '1 hour'`,
    ),
    "30",
  );
  checks += 2;
  // Pending cap remains exact under concurrent new offers.
  await sql(
    `update private.invitation_send_attempts set created_at=now()-interval '2 hours';update private.company_invitations set status='cancelled' where status='pending';insert into private.company_invitations(workspace_id,email,project_ids,role,invited_by) select '${a}','pending-'||n||'@example.test',array['${pa}'::uuid],'viewer','${o1}' from generate_series(1,99)n`,
  );
  const pending = await Promise.allSettled([
    as(o3, prepare(a, pa, "pending-a@example.test")),
    as(o4, prepare(a, pa, "pending-b@example.test")),
  ]);
  assert.equal(pending.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await scalar(
      `select count(*) from private.company_invitations where workspace_id='${a}' and status='pending' and expires_at>now()`,
    ),
    "100",
  );
  checks += 2;
  console.log(
    `PASS: ${checks} multi-connection PostgreSQL concurrency assertions; no ports, hosted data or mail.`,
  );
} finally {
  await run(["rm", "-f", container]).catch(() => undefined);
}
