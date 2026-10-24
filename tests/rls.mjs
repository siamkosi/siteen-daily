// Real embedded PostgreSQL, with minimal Auth/Storage schema stand-ins.
// Verifies SQL/RLS semantics, not the Supabase Auth/Storage HTTP services.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
let checks = 0;
await db.exec(
  `create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);alter table storage.objects enable row level security;grant usage on schema public,storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`,
);
await db.exec(
  "alter table auth.users add column email text,add column email_confirmed_at timestamptz default now(),add column is_anonymous boolean default false;",
);
await db.exec("alter table storage.objects add column metadata jsonb;");
for (const name of readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .sort())
  await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
const owner = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  viewer = "10000000-0000-4000-8000-000000000003";
await db.exec(
  `insert into auth.users(id,email) values('${owner}','owner@example.test'),('${other}','other@example.test'),('${viewer}','viewer@example.test');`,
);
async function as(user, fn) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function denied(sql) {
  await assert.rejects(() => db.exec(sql), undefined, sql);
  checks++;
}
async function count(table, n) {
  const r = await db.query(`select count(*)::int as n from ${table}`);
  assert.equal(r.rows[0].n, n);
  checks++;
}
const workspace = await as(owner, async () => {
  const r = await db.query(`select public.create_workspace('บริษัท เอ') as id`);
  return r.rows[0].id;
});
const workspaceB = await as(other, async () => {
  const r = await db.query(`select public.create_workspace('บริษัท บี') as id`);
  return r.rows[0].id;
});
await db.exec(
  `insert into public.memberships values('${workspace}','${viewer}','member');`,
);
const project = "20000000-0000-4000-8000-000000000001",
  projectB = "20000000-0000-4000-8000-000000000002",
  report = "30000000-0000-4000-8000-000000000001",
  photo = "40000000-0000-4000-8000-000000000001";
await as(owner, async () => {
  await count("workspaces", 1);
  await db.exec(
    `insert into public.projects(id,workspace_id,name) values('${project}','${workspace}','โครงการ เอ');insert into public.daily_reports(id,workspace_id,project_id,report_date,weather,workers,work_done,created_by) values('${report}','${workspace}','${project}',current_date,'แดดออก',12,'เทคอนกรีต','${owner}');`,
  );
  await count("daily_reports", 1);
  await denied(
    `insert into public.memberships values('${workspaceB}','${owner}','owner');`,
  );
  await denied(
    `update public.projects set workspace_id='${workspaceB}' where id='${project}';`,
  );
  await denied(
    `update public.daily_reports set expected_version=row_version,created_by='${other}' where id='${report}';`,
  );
  await db.exec(
    `update public.projects set status='completed' where id='${project}';update public.daily_reports set expected_version=row_version,workers=15 where id='${report}';`,
  );
  checks++;
});
await as(other, async () => {
  await count("projects", 0);
  await count("daily_reports", 0);
  await db.exec(
    `insert into public.projects(id,workspace_id,name) values('${projectB}','${workspaceB}','โครงการ บี');`,
  );
  await denied(
    `insert into public.daily_reports(workspace_id,project_id,report_date,weather,work_done,created_by) values('${workspaceB}','${project}',current_date,'แดดออก','ข้ามบริษัท','${other}');`,
  );
  await denied(
    `insert into public.projects(workspace_id,name) values('${workspace}','ปลอม');`,
  );
  const r = await db.query(
    `update public.daily_reports set expected_version=row_version,workers=999 where id='${report}' returning id`,
  );
  assert.equal(r.rows.length, 0);
  checks++;
});
const object = `${workspace}/${project}/${report}/${photo}.png`;
await as(owner, async () => {
  await db.exec(
    `insert into storage.objects(bucket_id,name) values('site-photos','${object}');insert into public.photos(id,workspace_id,project_id,report_id,path) values('${photo}','${workspace}','${project}','${report}','${object}');`,
  );
  await count("storage.objects", 1);
  await count("photos", 1);
  await denied(
    `insert into storage.objects(bucket_id,name) values('site-photos','${workspace}/${project}/00000000-0000-4000-8000-000000000000/${photo}.png');`,
  );
  await denied(
    `insert into storage.objects(bucket_id,name) values('site-photos','malformed/path');`,
  );
  const moved = await db.query(
    `update storage.objects set name='${workspaceB}/${projectB}/${report}/${photo}.png' where name='${object}' returning id;`,
  );
  assert.equal(moved.rows.length, 0);
  checks++;
});
await as(owner, () =>
  db.exec(
    `select public.set_project_assignment('${workspace}','${project}','${viewer}','viewer',0,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${workspace}')) m where m->>'user_id'='${viewer}'))`,
  ),
);
await as(viewer, async () => {
  await count("projects", 1);
  await count("daily_reports", 1);
  await count("photos", 1);
  await count("storage.objects", 1);
  await denied(
    `insert into public.projects(workspace_id,name) values('${workspace}','viewer write');`,
  );
  await denied(
    `insert into storage.objects(bucket_id,name) values('site-photos','${object}');`,
  );
  const r = await db.query(
    `update public.daily_reports set expected_version=row_version,workers=999 where id='${report}' returning id`,
  );
  assert.equal(r.rows.length, 0);
  checks++;
  const d = await db.query(
    `delete from storage.objects where name='${object}' returning id`,
  );
  assert.equal(d.rows.length, 0);
  checks++;
});
await as(other, async () => {
  await count("photos", 0);
  await count("storage.objects", 0);
  await denied(
    `insert into storage.objects(bucket_id,name) values('site-photos','${object}');`,
  );
});
await db.exec(`set role anon;`);
await denied(`select * from public.projects;`);
await denied(`select public.create_workspace('anonymous');`);
await db.exec("reset role");
// A member of two workspaces can edit a teammate's report, but cannot
// reparent an existing report or spoof the author of a new report.
await db.exec(
  `insert into public.memberships values('${workspace}','${other}','member');`,
);
await as(owner, () =>
  db.exec(
    `select public.set_project_assignment('${workspace}','${project}','${other}','editor',0,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${workspace}')) m where m->>'user_id'='${other}'))`,
  ),
);
await as(other, async () => {
  await count("projects", 2);
  await db.exec(
    `update public.daily_reports set expected_version=row_version,workers=20 where id='${report}';`,
  );
  const updated = await db.query(
    `select workers from public.daily_reports where id='${report}'`,
  );
  assert.equal(updated.rows[0].workers, 20);
  checks++;
  await denied(
    `update public.daily_reports set expected_version=row_version,workspace_id='${workspaceB}',project_id='${projectB}' where id='${report}';`,
  );
  await denied(
    `insert into public.daily_reports(workspace_id,project_id,report_date,weather,work_done,created_by) values('${workspaceB}','${projectB}',current_date,'แดดออก','ปลอมผู้บันทึก','${owner}');`,
  );
  await denied(
    `insert into public.daily_reports(workspace_id,project_id,report_date,weather,work_done,created_by) values('${workspace}','${project}',current_date,'แดดออก','รายงานซ้ำ','${other}');`,
  );
  await denied(
    `insert into public.photos(workspace_id,project_id,report_id,path) values('${workspaceB}','${projectB}','${report}','invalid');`,
  );
});
await as(owner, async () => {
  await db.exec(
    `delete from storage.objects where name='${object}';delete from public.photos where id='${photo}';`,
  );
  await count("photos", 0);
  await count("storage.objects", 0);
  const details = {
    version: 1,
    meta: { report_number: "TEST-041" },
    labor: [
      { group: "staff", label: "วิศวกร", count: 2, hours: 8 },
      { group: "daily", label: "ช่าง", count: 12, hours: 7.5 },
    ],
    equipment: [],
    progress: [],
  };
  await db.query(
    `update public.daily_reports set expected_version=row_version,report_details=$1::jsonb,workers=999 where id=$2`,
    [JSON.stringify(details), report],
  );
  const derived = await db.query(
    `select workers from public.daily_reports where id=$1`,
    [report],
  );
  assert.equal(derived.rows[0].workers, 12);
  checks++;
  await db.query(
    `update public.daily_reports set expected_version=row_version,weather='ยังไม่บันทึก' where id=$1`,
    [report],
  );
  assert.equal(
    (
      await db.query(`select weather from public.daily_reports where id=$1`, [
        report,
      ])
    ).rows[0].weather,
    "ยังไม่บันทึก",
  );
  checks++;
  await denied(
    `update public.daily_reports set expected_version=row_version,weather='invalid' where id='${report}'`,
  );
  const material = {
    label: "คอนกรีต",
    kind: "received",
    quantity: 12.5,
    unit: "ลบ.ม.",
    notes: "ทดสอบ",
  };
  await db.query(
    `update public.daily_reports set expected_version=row_version,report_details=$1::jsonb where id=$2`,
    [JSON.stringify({ ...details, material_rows: [material] }), report],
  );
  checks++;
  for (const material_rows of [
    [{ ...material, quantity: -1 }],
    [{ ...material, unit: "" }],
    [{ ...material, kind: "invalid" }],
    {},
    [{ ...material, quantity: "12" }],
  ]) {
    await assert.rejects(() =>
      db.query(
        `update public.daily_reports set expected_version=row_version,report_details=$1::jsonb where id=$2`,
        [JSON.stringify({ ...details, material_rows }), report],
      ),
    );
    checks++;
  }
  const invalid = { ...details, labor: [{ ...details.labor[0], hours: 25 }] };
  await assert.rejects(() =>
    db.query(
      `update public.daily_reports set expected_version=row_version,report_details=$1::jsonb where id=$2`,
      [JSON.stringify(invalid), report],
    ),
  );
  checks++;
  await denied(
    `update public.daily_reports set expected_version=row_version,report_details='[]'::jsonb where id='${report}';`,
  );
});
// Owner-only member administration; ownership is never mutable through this RPC.
await as(owner, async () => {
  const members = await db.query(
    `select * from public.list_company_members('${workspace}')`,
  );
  assert.equal(members.rows.length, 3);
  checks++;
  assert.ok(
    members.rows.some(
      (m) => m.email === "other@example.test" && m.role === "member",
    ),
  );
  checks++;
  await denied(`select public.list_company_members('${workspaceB}')`);
  for (const role of ["owner", "invalid"])
    await denied(
      `select public.set_company_member_role('${workspace}','${other}','${role}','editor')`,
    );
  await denied(
    `select public.set_company_member_role('${workspace}','${owner}','viewer','editor')`,
  );
  await denied(
    `select public.set_company_member_role('${workspaceB}','${other}','viewer','editor')`,
  );
  await denied(
    `select public.set_company_member_role('${workspace}','00000000-0000-4000-8000-000000000000','viewer','editor')`,
  );
  await denied(
    `select public.set_company_member_role('${workspace}','${other}',null,'editor')`,
  );
  await denied(
    `select public.set_company_member_role('${workspace}','${other}','viewer',null)`,
  );
  await db.exec(
    `select public.set_project_assignment('${workspace}','${project}','${other}','viewer',1,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${workspace}')) m where m->>'user_id'='${other}'))`,
  );
  checks++;
  await denied(
    `select public.set_company_member_role('${workspace}','${other}','member','editor')`,
  );
});
await as(other, async () => {
  await denied(`select public.list_company_members('${workspace}')`);
  await denied(
    `select public.set_company_member_role('${workspace}','${viewer}','editor','viewer')`,
  );
  await denied(
    `select private.change_company_member_role('${workspace}','${other}','member','viewer')`,
  );
  await denied(
    `update public.memberships set role='owner' where user_id='${other}'`,
  );
  const blocked = await db.query(
    `update public.daily_reports set expected_version=row_version,work_done='denied' where id='${report}' returning id`,
  );
  assert.equal(blocked.rows.length, 0);
  checks++;
});
await as(viewer, async () => {
  await denied(`select public.list_company_members('${workspace}')`);
  await denied(
    `select public.set_company_member_role('${workspace}','${other}','member','viewer')`,
  );
});
await as(owner, async () => {
  await db.exec(
    `select public.set_project_assignment('${workspace}','${project}','${other}','editor',2,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${workspace}')) m where m->>'user_id'='${other}'))`,
  );
  checks++;
});
await as(other, async () => {
  await db.exec(
    `update public.daily_reports set expected_version=row_version,work_done=work_done where id='${report}'`,
  );
  checks++;
  await denied(`select public.list_company_members('${workspace}')`);
});
await db.exec(`set role anon`);
await denied(`select public.list_company_members('${workspace}')`);
await denied(
  `select public.set_company_member_role('${workspace}','${other}','viewer','editor')`,
);
await db.exec(`reset role`);
const requestId = "50000000-0000-4000-8000-000000000001";
await as(owner, async () => {
  await db.exec(
    `insert into public.daily_requests(id,workspace_id,project_id,report_date,work_done,created_by) values('${requestId}','${workspace}','${project}',current_date+1,'แผนงานทดสอบ','${owner}')`,
  );
  checks++;
  await count("daily_requests", 1);
  await db.exec(
    `update public.daily_requests set expected_version=row_version,status='submitted' where id='${requestId}'`,
  );
  checks++;
  await denied(
    `insert into public.daily_requests(workspace_id,project_id,report_date,work_done,created_by) values('${workspace}','${project}',current_date+1,'ซ้ำ','${owner}')`,
  );
  await denied(
    `insert into public.daily_requests(workspace_id,project_id,report_date,work_done,created_by) values('${workspace}','${projectB}',current_date+2,'ข้ามบริษัท','${owner}')`,
  );
  await denied(
    `insert into public.daily_requests(workspace_id,project_id,report_date,work_done,created_by) values('${workspace}','${project}',current_date+2,'ปลอมผู้ขอ','${viewer}')`,
  );
  await denied(
    `update public.daily_requests set expected_version=row_version,created_by='${other}' where id='${requestId}'`,
  );
  await denied(
    `update public.daily_requests set expected_version=row_version,workspace_id='${workspaceB}',project_id='${projectB}' where id='${requestId}'`,
  );
  await denied(
    `update public.daily_requests set expected_version=row_version,status='approved' where id='${requestId}'`,
  );
  await denied(
    `update public.daily_requests set expected_version=row_version,report_details='[]'::jsonb where id='${requestId}'`,
  );
});
await as(other, async () => {
  // This user is editor in A and owner in B: can edit A without changing author.
  await db.exec(
    `update public.daily_requests set expected_version=row_version,work_done='ปรับแผน' where id='${requestId}'`,
  );
  checks++;
});
await as(viewer, async () => {
  await count("daily_requests", 1);
  const write = await db.query(
    `update public.daily_requests set expected_version=row_version,work_done='denied' where id='${requestId}' returning id`,
  );
  assert.equal(write.rows.length, 0);
  checks++;
  await denied(
    `insert into public.daily_requests(workspace_id,project_id,report_date,work_done,created_by) values('${workspace}','${project}',current_date,'ห้าม','${viewer}')`,
  );
});
await db.exec(
  `delete from public.memberships where workspace_id='${workspace}' and user_id='${other}'`,
);
await as(other, async () => {
  await count("daily_requests", 0);
  const write = await db.query(
    `update public.daily_requests set expected_version=row_version,work_done='ข้ามบริษัท' where id='${requestId}' returning id`,
  );
  assert.equal(write.rows.length, 0);
  checks++;
});
await db.exec("set role anon");
await denied("select * from public.daily_requests");
await db.exec("reset role");
const cover = `${workspace}/${project}/60000000-0000-4000-8000-000000000001.png`;
await as(owner, async () => {
  await db.exec(
    `insert into storage.objects(bucket_id,name) values('project-covers','${cover}');update public.projects set cover_path='${cover}' where id='${project}';`,
  );
  checks++;
  await denied(
    `update public.projects set cover_path='${workspaceB}/${projectB}/60000000-0000-4000-8000-000000000001.png' where id='${project}'`,
  );
  await denied(
    `insert into storage.objects(bucket_id,name) values('project-covers','${workspace}/00000000-0000-4000-8000-000000000000/60000000-0000-4000-8000-000000000001.png')`,
  );
  await denied(
    `insert into storage.objects(bucket_id,name) values('project-covers','malformed/path.png')`,
  );
});
await as(viewer, async () => {
  await count("storage.objects", 1);
  const read = await db.query(
    `select cover_path from public.projects where id='${project}'`,
  );
  assert.equal(read.rows[0].cover_path, cover);
  checks++;
  await denied(
    `insert into storage.objects(bucket_id,name) values('project-covers','${cover}')`,
  );
  const write = await db.query(
    `update public.projects set cover_path=null where id='${project}' returning id`,
  );
  assert.equal(write.rows.length, 0);
  checks++;
  const remove = await db.query(
    `delete from storage.objects where name='${cover}' returning id`,
  );
  assert.equal(remove.rows.length, 0);
  checks++;
});
await as(other, async () => {
  await count("storage.objects", 0);
  await denied(
    `insert into storage.objects(bucket_id,name) values('project-covers','${cover}')`,
  );
});
await db.exec(
  `insert into public.memberships values('${workspace}','${other}','member')`,
);
await as(owner, () =>
  db.exec(
    `select public.set_project_assignment('${workspace}','${project}','${other}','editor',0,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${workspace}')) m where m->>'user_id'='${other}'))`,
  ),
);
await as(other, async () => {
  await count("storage.objects", 1);
  await db.exec(
    `update public.projects set cover_path=null where id='${project}'`,
  );
  checks++;
  const moved = await db.query(
    `update storage.objects set name='${workspaceB}/${projectB}/60000000-0000-4000-8000-000000000001.png' where name='${cover}' returning id`,
  );
  assert.equal(moved.rows.length, 0);
  checks++;
  await db.exec(
    `delete from storage.objects where name='${cover}';insert into storage.objects(bucket_id,name) values('project-covers','${cover}')`,
  );
  checks++;
});
await db.exec("set role anon");
await denied(`select private.can_access_project_cover('${cover}')`);
await denied(
  `insert into storage.objects(bucket_id,name) values('project-covers','${cover}')`,
);
await db.exec("reset role");
await as(owner, async () => {
  await denied("select * from private.pdf_export_jobs");
  await denied(
    `insert into private.pdf_export_jobs(user_id,requested_at,lease_until) values('${owner}',now(),now())`,
  );
});
const admission = async (user) =>
  (
    await as(user, async () =>
      db.query("select * from public.begin_pdf_export()"),
    )
  ).rows[0];
const finish = async (user, lease) =>
  as(user, async () => db.query(`select public.finish_pdf_export('${lease}')`));
const ownerJob = await admission(owner);
assert.equal(ownerJob.allowed, true);
checks++;
await finish(viewer, ownerJob.lease_id);
assert.equal((await admission(owner)).reason, "user_busy");
checks++;
const editorJob = await admission(other);
assert.equal(editorJob.allowed, true);
checks++;
assert.equal((await admission(viewer)).reason, "global_busy");
checks++;
await finish(owner, ownerJob.lease_id);
const viewerJob = await admission(viewer);
assert.equal(viewerJob.allowed, true);
checks++;
await finish(viewer, viewerJob.lease_id);
await finish(other, editorJob.lease_id);
await db.exec("delete from private.pdf_export_jobs");
for (let i = 0; i < 6; i++) {
  const job = await admission(owner);
  assert.equal(job.allowed, true);
  await finish(owner, job.lease_id);
  checks++;
}
const limited = await admission(owner);
assert.equal(limited.allowed, false);
assert.equal(limited.reason, "rate");
assert.ok(limited.retry_after >= 1 && limited.retry_after <= 60);
checks++;
const independent = await admission(other);
assert.equal(independent.allowed, true);
checks++;
await db.exec(
  `update private.pdf_export_jobs set lease_until=now()-interval '1 second' where id='${independent.lease_id}'`,
);
const recovered = await admission(other);
assert.equal(recovered.allowed, true);
checks++;
await finish(other, recovered.lease_id);
const outsider = "10000000-0000-4000-8000-000000000099";
await db.exec(
  `insert into auth.users(id,email) values('${outsider}','outsider@example.test')`,
);
await as(outsider, async () => {
  await denied("select * from public.begin_pdf_export()");
});
await db.exec("set role anon");
await denied("select * from public.begin_pdf_export()");
await denied(`select public.finish_pdf_export('${ownerJob.lease_id}')`);
await db.exec("reset role");
// Lifecycle checks exercise real triggers/RLS for BOTH document tables.
for (const [kind, table] of [
  ["report", "daily_reports"],
  ["request", "daily_requests"],
]) {
  const doc = crypto.randomUUID(),
    foreignDraft = crypto.randomUUID(),
    replacement = crypto.randomUUID();
  const dateOffset = kind === "report" ? 20 : 21;
  await as(owner, async () => {
    await db.exec(
      `insert into public.${table}(id,workspace_id,project_id,report_date,weather,work_done,created_by) values('${foreignDraft}','${workspace}','${project}',current_date-${dateOffset + 1},'ยังไม่บันทึก','owner draft','${owner}')`,
    );
    await denied(
      `insert into public.${table}(workspace_id,project_id,report_date,weather,work_done,created_by,status) values('${workspace}','${project}',current_date-90,'ยังไม่บันทึก','fake cancelled','${owner}','cancelled')`,
    );
  });
  async function action(user, id, operation, reason = null, expected = null) {
    return as(user, async () => {
      const timestamp =
        expected ??
        (
          await db.query(
            `select updated_at from public.${table} where id='${id}'`,
          )
        ).rows[0]?.updated_at;
      return db.query(
        `select public.change_document_state($1,$2,$3,$4,$5,$6)`,
        [workspace, kind, id, operation, timestamp, reason],
      );
    });
  }
  async function rejectAction(
    user,
    id,
    operation,
    reason = null,
    expected = null,
  ) {
    await assert.rejects(() => action(user, id, operation, reason, expected));
    checks++;
  }
  await rejectAction(other, foreignDraft, "trash");
  await as(other, async () => {
    await db.exec(
      `insert into public.${table}(id,workspace_id,project_id,report_date,weather,work_done,created_by) values('${doc}','${workspace}','${project}',current_date-${dateOffset},'ยังไม่บันทึก','editor draft','${other}')`,
    );
  });
  await rejectAction(viewer, doc, "trash");
  await rejectAction(outsider, doc, "trash", null, new Date().toISOString());
  let attachment;
  if (kind === "report") {
    attachment = `${workspace}/${project}/${doc}/${crypto.randomUUID()}.png`;
    await as(other, async () => {
      await db.exec(
        `insert into storage.objects(bucket_id,name) values('site-photos','${attachment}');insert into public.photos(id,workspace_id,project_id,report_id,path) values('${attachment.split("/")[3].slice(0, -4)}','${workspace}','${project}','${doc}','${attachment}')`,
      );
    });
  }
  await action(other, doc, "trash");
  await as(other, async () => {
    const row = (
      await db.query(`select * from public.${table} where id='${doc}'`)
    ).rows[0];
    assert.equal(row.deleted_by, other);
    assert.ok(row.deleted_at);
    checks += 2;
    await denied(
      `update public.${table} set expected_version=row_version,work_done='tamper' where id='${doc}'`,
    );
    await denied(
      `update public.${table} set expected_version=row_version,deleted_at=now()-interval '1 day' where id='${doc}'`,
    );
    await denied(`delete from public.${table} where id='${doc}'`);
    if (attachment) {
      assert.equal(
        (
          await db.query(
            `select id from public.photos where report_id='${doc}'`,
          )
        ).rows.length,
        1,
      );
      checks++;
      assert.equal(
        (
          await db.query(
            `delete from public.photos where report_id='${doc}' returning id`,
          )
        ).rows.length,
        0,
      );
      checks++;
      assert.equal(
        (
          await db.query(
            `delete from storage.objects where name='${attachment}' returning id`,
          )
        ).rows.length,
        0,
      );
      checks++;
      await denied(
        `insert into storage.objects(bucket_id,name) values('site-photos','${workspace}/${project}/${doc}/${crypto.randomUUID()}.png')`,
      );
    }
  });
  await as(viewer, async () => {
    assert.equal(
      (await db.query(`select id from public.${table} where id='${doc}'`)).rows
        .length,
      0,
    );
    checks++;
  });
  await rejectAction(other, doc, "restore");
  await as(owner, async () => {
    await db.exec(
      `insert into public.${table}(id,workspace_id,project_id,report_date,weather,work_done,created_by) values('${replacement}','${workspace}','${project}',current_date-${dateOffset},'ยังไม่บันทึก','replacement','${owner}')`,
    );
  });
  await rejectAction(owner, doc, "restore"); // Partial unique index protects restore races.
  await action(owner, replacement, "trash");
  await action(owner, doc, "restore");
  await as(owner, async () => {
    assert.equal(
      (
        await db.query(
          `select deleted_at from public.${table} where id='${doc}'`,
        )
      ).rows[0].deleted_at,
      null,
    );
    checks++;
    await db.exec(
      `update public.${table} set expected_version=row_version,status='submitted' where id='${doc}'`,
    );
    await denied(
      `update public.${table} set expected_version=row_version,status='draft' where id='${doc}'`,
    );
  });
  await rejectAction(owner, doc, "trash");
  await rejectAction(other, doc, "cancel", "not allowed");
  await rejectAction(owner, doc, "cancel", "   ");
  await rejectAction(owner, doc, "cancel", "reason", "2000-01-01T00:00:00Z");
  await action(owner, doc, "cancel", "แผนงานเปลี่ยน เก็บประวัติเดิม");
  await as(owner, async () => {
    const cancelled = (
      await db.query(`select * from public.${table} where id='${doc}'`)
    ).rows[0];
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.cancelled_by, owner);
    assert.equal(cancelled.work_done, "editor draft");
    checks += 3;
    await denied(
      `update public.${table} set expected_version=row_version,work_done='erase original' where id='${doc}'`,
    );
    await denied(
      `update public.${table} set expected_version=row_version,status='submitted',cancellation_reason=null,cancelled_at=null,cancelled_by=null where id='${doc}'`,
    );
    await denied(
      `update public.document_events set reason='tampered' where document_id='${doc}'`,
    );
    await denied(
      `delete from public.document_events where document_id='${doc}'`,
    );
    await denied(
      `insert into public.document_events(workspace_id,document_kind,document_id,action,after_data) values('${workspace}','${kind}','${doc}','cancelled','{}')`,
    );
    const history = (
      await db.query(
        `select * from public.document_events where document_id='${doc}' order by occurred_at`,
      )
    ).rows;
    assert.deepEqual(
      history.map((e) => e.action),
      ["created", "trashed", "restored", "submitted", "cancelled"],
    );
    assert.equal(history.at(-1).before_data.status, "submitted");
    assert.equal(history.at(-1).before_data.work_done, "editor draft");
    checks += 3;
    if (attachment) {
      assert.equal(history.at(-1).photos.length, 1);
      checks++;
      const removed = await db.query(
        `delete from storage.objects where name='${attachment}' returning id`,
      );
      assert.equal(removed.rows.length, 0);
      checks++;
      assert.equal(
        (
          await db.query(
            `delete from public.photos where report_id='${doc}' returning id`,
          )
        ).rows.length,
        0,
      );
      checks++;
      await denied(
        `insert into storage.objects(bucket_id,name) values('site-photos','${workspace}/${project}/${doc}/${crypto.randomUUID()}.png')`,
      );
    }
  });
  await as(viewer, async () => {
    assert.ok(
      (
        await db.query(
          `select id from public.document_events where document_id='${doc}'`,
        )
      ).rows.length,
    );
    checks++;
  });
  await as(outsider, async () => {
    assert.equal(
      (
        await db.query(
          `select id from public.document_events where document_id='${doc}'`,
        )
      ).rows.length,
      0,
    );
    checks++;
  });
  // Controlled clock fixture: owner cannot override 30-day expiry via direct API.
  await db.exec(
    `alter table public.${table} disable trigger zz_${kind}_lifecycle;update public.${table} set expected_version=row_version,deleted_at=now()-interval '30 days' where id='${replacement}';alter table public.${table} enable trigger zz_${kind}_lifecycle;`,
  );
  await rejectAction(owner, replacement, "restore");
  await db.exec(
    `alter table public.${table} disable trigger zz_${kind}_lifecycle;update public.${table} set expected_version=row_version,deleted_at=now()-interval '29 days 23 hours' where id='${replacement}';alter table public.${table} enable trigger zz_${kind}_lifecycle;`,
  );
  await action(owner, replacement, "restore");
  await as(owner, async () => {
    assert.equal(
      (
        await db.query(
          `select deleted_at from public.${table} where id='${replacement}'`,
        )
      ).rows[0].deleted_at,
      null,
    );
    checks++;
  });
  await db.exec(`set role anon`);
  await denied(
    `select public.change_document_state('${workspace}','${kind}','${doc}','cancel',now(),'forged')`,
  );
  await denied(`select * from public.document_events`);
  await db.exec("reset role");
}
// Optimized and preview variants share company/report permissions and lifecycle.
const variantReport = crypto.randomUUID(),
  variantPhoto = crypto.randomUUID();
const variantBase = `${workspace}/${project}/${variantReport}/${variantPhoto}`;
await as(owner, async () => {
  await db.exec(
    `insert into public.daily_reports(id,workspace_id,project_id,report_date,weather,work_done,created_by) values('${variantReport}','${workspace}','${project}',current_date-55,'ยังไม่บันทึก','photo variants','${owner}')`,
  );
  await db.exec(
    `insert into storage.objects(bucket_id,name) values('site-photos','${variantBase}.jpeg'),('site-photos','${variantBase}.thumb.jpeg')`,
  );
  await db.exec(
    `insert into public.photos(id,workspace_id,project_id,report_id,path,thumbnail_path,image_width,image_height,byte_size,thumbnail_byte_size,source_byte_size) values('${variantPhoto}','${workspace}','${project}','${variantReport}','${variantBase}.jpeg','${variantBase}.thumb.jpeg',2560,1920,900000,40000,4000000)`,
  );
  await denied(
    `update public.photos set thumbnail_path='${variantBase}.other.jpeg' where id='${variantPhoto}'`,
  );
  const bad = crypto.randomUUID(),
    badBase = `${workspace}/${project}/${variantReport}/${bad}`;
  await denied(
    `insert into public.photos(id,workspace_id,project_id,report_id,path,thumbnail_path) values('${bad}','${workspace}','${project}','${variantReport}','${badBase}.jpeg','${badBase}.thumb.jpeg')`,
  );
  await denied(
    `insert into public.photos(id,workspace_id,project_id,report_id,path,thumbnail_path,image_width,image_height,byte_size,thumbnail_byte_size,source_byte_size) values('${bad}','${workspace}','${project}','${variantReport}','${badBase}.jpeg','${variantBase}.thumb.jpeg',2560,1920,900000,40000,4000000)`,
  );
  await denied(
    `insert into storage.objects(bucket_id,name) values('site-photos','${variantBase}.thumb.png')`,
  );
  await denied(
    `insert into storage.objects(bucket_id,name) values('site-photos','${workspaceB}/${projectB}/${variantReport}/${variantPhoto}.thumb.jpeg')`,
  );
});
await as(viewer, async () => {
  assert.equal(
    (
      await db.query(
        `select id from storage.objects where name='${variantBase}.thumb.jpeg'`,
      )
    ).rows.length,
    1,
  );
  checks++;
  await denied(
    `insert into storage.objects(bucket_id,name) values('site-photos','${workspace}/${project}/${variantReport}/${crypto.randomUUID()}.thumb.jpeg')`,
  );
  assert.equal(
    (
      await db.query(
        `delete from storage.objects where name='${variantBase}.thumb.jpeg' returning id`,
      )
    ).rows.length,
    0,
  );
  checks++;
});
await as(outsider, async () => {
  assert.equal(
    (
      await db.query(
        `select id from storage.objects where name='${variantBase}.thumb.jpeg'`,
      )
    ).rows.length,
    0,
  );
  checks++;
});
async function variantAction(action, reason = null) {
  await as(owner, async () => {
    const timestamp = (
      await db.query(
        `select updated_at from public.daily_reports where id='${variantReport}'`,
      )
    ).rows[0].updated_at;
    await db.query(
      `select public.change_document_state($1,'report',$2,$3,$4,$5)`,
      [workspace, variantReport, action, timestamp, reason],
    );
  });
}
await variantAction("trash");
await as(owner, async () => {
  assert.equal(
    (
      await db.query(
        `delete from storage.objects where name in ('${variantBase}.jpeg','${variantBase}.thumb.jpeg') returning id`,
      )
    ).rows.length,
    0,
  );
  checks++;
  assert.equal(
    (
      await db.query(
        `select id from storage.objects where name in ('${variantBase}.jpeg','${variantBase}.thumb.jpeg')`,
      )
    ).rows.length,
    2,
  );
  checks++;
});
await as(viewer, async () => {
  assert.equal(
    (
      await db.query(
        `select id from storage.objects where name='${variantBase}.thumb.jpeg'`,
      )
    ).rows.length,
    0,
  );
  checks++;
});
await variantAction("restore");
await as(owner, async () => {
  await db.exec(
    `update public.daily_reports set expected_version=row_version,status='submitted' where id='${variantReport}'`,
  );
});
await variantAction("cancel", "preserve both variants");
await as(owner, async () => {
  assert.equal(
    (
      await db.query(
        `delete from storage.objects where name in ('${variantBase}.jpeg','${variantBase}.thumb.jpeg') returning id`,
      )
    ).rows.length,
    0,
  );
  checks++;
  const snapshot = (
    await db.query(
      `select photos from public.document_events where document_id='${variantReport}' and action='cancelled'`,
    )
  ).rows[0].photos;
  assert.equal(snapshot[0].thumbnail_path, variantBase + ".thumb.jpeg");
  checks++;
});
// Storage summaries count actual objects (including legacy and retained files),
// not only client byte-size columns or documents visible under trash RLS.
{
  const storageWorkspace = await as(
    owner,
    async () =>
      (
        await db.query(
          `select public.create_workspace('พื้นที่ทดสอบโควตา') as id`,
        )
      ).rows[0].id,
  );
  const sp1 = crypto.randomUUID(),
    sp2 = crypto.randomUUID(),
    sp0 = crypto.randomUUID(),
    sr1 = crypto.randomUUID(),
    sr2 = crypto.randomUUID(),
    ph1 = crypto.randomUUID(),
    ph2 = crypto.randomUUID();
  const main = `${storageWorkspace}/${sp1}/${sr1}/${ph1}.jpeg`,
    thumb = `${storageWorkspace}/${sp1}/${sr1}/${ph1}.thumb.jpeg`,
    legacy = `${storageWorkspace}/${sp2}/${sr2}/${ph2}.png`,
    cover = `${storageWorkspace}/${sp1}/${crypto.randomUUID()}.jpeg`,
    orphan = `${storageWorkspace}/${sp2}/${sr2}/${crypto.randomUUID()}.jpeg`,
    unknown = `${storageWorkspace}/missing-project/${crypto.randomUUID()}.jpeg`;
  await db.exec(
    `insert into public.memberships values('${storageWorkspace}','${other}','member'),('${storageWorkspace}','${viewer}','member')`,
  );
  await as(owner, async () => {
    await db.exec(`insert into public.projects(id,workspace_id,name) values('${sp1}','${storageWorkspace}','หนึ่ง'),('${sp2}','${storageWorkspace}','สอง'),('${sp0}','${storageWorkspace}','ยังไม่มีรูป');
  insert into public.daily_reports(id,workspace_id,project_id,report_date,weather,work_done,status,created_by) values('${sr1}','${storageWorkspace}','${sp1}',current_date,'ยังไม่บันทึก','one','draft','${owner}'),('${sr2}','${storageWorkspace}','${sp2}',current_date,'ยังไม่บันทึก','two','submitted','${owner}');
  insert into public.photos(id,workspace_id,project_id,report_id,path,thumbnail_path,image_width,image_height,byte_size,thumbnail_byte_size,source_byte_size) values('${ph1}','${storageWorkspace}','${sp1}','${sr1}','${main}','${thumb}',1000,800,500000,50000,1000000);
  insert into public.photos(id,workspace_id,project_id,report_id,path) values('${ph2}','${storageWorkspace}','${sp2}','${sr2}','${legacy}');
  update public.projects set cover_path='${cover}' where id='${sp1}';`);
  });
  await db.query(
    `insert into storage.objects(bucket_id,name,metadata) values
  ('site-photos',$1,'{"size":500000}'),('site-photos',$2,'{"size":"50000"}'),
  ('site-photos',$3,'{"size":120000}'),('project-covers',$4,'{"size":100000}'),
  ('site-photos',$5,'{"size":30000}'),('site-photos',$6,'{"size":"unknown"}')`,
    [main, thumb, legacy, cover, orphan, unknown],
  );
  async function storageSummary(user) {
    return as(
      user,
      async () =>
        (
          await db.query(`select public.company_photo_storage($1) as summary`, [
            storageWorkspace,
          ])
        ).rows[0].summary,
    );
  }
  let usage = await storageSummary(owner);
  assert.equal(usage.quota_bytes, null);
  assert.equal(usage.totals.total_bytes, 800000);
  assert.equal(usage.totals.total_files, 6);
  assert.equal(usage.totals.photo_count, 2);
  assert.equal(usage.totals.unknown_files, 1);
  checks += 5;
  assert.equal(
    usage.projects.find((p) => p.project_id === sp1).total_bytes,
    650000,
  );
  assert.equal(
    usage.projects.find((p) => p.project_id === sp2).total_bytes,
    150000,
  );
  assert.equal(usage.projects.find((p) => p.project_id === sp0).total_bytes, 0);
  assert.equal(
    usage.projects.find((p) => p.project_id === null).unknown_files,
    1,
  );
  checks += 4;
  // Storage metadata is authoritative; typed photo sizes are only a fallback.
  await db.query(
    `update storage.objects set metadata='{"size":600000}' where name=$1`,
    [main],
  );
  assert.equal((await storageSummary(owner)).totals.total_bytes, 900000);
  checks++;
  await db.query(`update storage.objects set metadata=null where name=$1`, [
    main,
  ]);
  assert.equal((await storageSummary(owner)).totals.total_bytes, 800000);
  checks++;
  await as(owner, async () => {
    let stamp = (
      await db.query(
        `select updated_at from public.daily_reports where id='${sr1}'`,
      )
    ).rows[0].updated_at;
    await db.query(
      `select public.change_document_state($1,'report',$2,'trash',$3,null)`,
      [storageWorkspace, sr1, stamp],
    );
    stamp = (
      await db.query(
        `select updated_at from public.daily_reports where id='${sr2}'`,
      )
    ).rows[0].updated_at;
    await db.query(
      `select public.change_document_state($1,'report',$2,'cancel',$3,'retained')`,
      [storageWorkspace, sr2, stamp],
    );
  });
  for (const member of [owner]) {
    usage = await storageSummary(member);
    assert.equal(usage.totals.total_bytes, 800000);
    assert.equal(usage.totals.trash_bytes, 550000);
    assert.equal(usage.totals.cancelled_bytes, 150000);
    checks += 3;
    const serialized = JSON.stringify(usage);
    assert.ok(
      !serialized.includes(main) &&
        !serialized.includes(unknown) &&
        !serialized.includes("metadata"),
    );
    checks++;
  }
  await as(viewer, async () => {
    assert.equal(
      (await db.query(`select id from public.photos where id='${ph1}'`)).rows
        .length,
      0,
    );
    checks++;
  });
  for (const unauthorized of [other, viewer, outsider])
    await as(unauthorized, async () => {
      await denied(
        `select public.company_photo_storage('${storageWorkspace}')`,
      );
      await denied(
        `select private.company_photo_storage('${storageWorkspace}')`,
      );
    });
  await as(owner, async () => {
    await denied(`select public.company_photo_storage('${workspaceB}')`);
    await denied(`select * from private.company_photo_quotas`);
    await denied(
      `select public.set_company_photo_quota('${storageWorkspace}',999,null)`,
    );
    await denied(
      `select public.set_company_photo_quota('${storageWorkspace}',-1,null)`,
    );
    await denied(
      `select public.set_company_photo_quota('${storageWorkspace}',1000000000000001,null)`,
    );
    await db.query(`select public.set_company_photo_quota($1,1000000,null)`, [
      storageWorkspace,
    ]);
    await denied(
      `select public.set_company_photo_quota('${storageWorkspace}',2000000,null)`,
    );
  });
  assert.equal((await storageSummary(owner)).quota_bytes, 1000000);
  checks++;
  for (const unauthorized of [other, viewer, outsider])
    await as(unauthorized, async () => {
      await denied(
        `select public.set_company_photo_quota('${storageWorkspace}',2000000,1000000)`,
      );
      await denied(
        `select private.set_company_photo_quota('${storageWorkspace}',2000000,1000000)`,
      );
      await denied(
        `update private.company_photo_quotas set quota_bytes=2000000 where workspace_id='${storageWorkspace}'`,
      );
    });
  await as(owner, async () => {
    await db.query(
      `select public.set_company_photo_quota($1,2000000,1000000)`,
      [storageWorkspace],
    );
    await db.query(`select public.set_company_photo_quota($1,null,2000000)`, [
      storageWorkspace,
    ]);
  });
  assert.equal((await storageSummary(owner)).quota_bytes, null);
  assert.equal((await storageSummary(owner)).totals.total_bytes, 800000);
  checks += 2;
  await db.exec("set role anon");
  await denied(`select public.company_photo_storage('${storageWorkspace}')`);
  await denied(
    `select public.set_company_photo_quota('${storageWorkspace}',1000000,null)`,
  );
  await db.exec("reset role");
}
// Two engineers open version 1; the later save must never replace version 2.
// Test the database gate itself, without trusting a REST filter or browser UI.
{
  const ws = await as(
    owner,
    async () =>
      (await db.query(`select public.create_workspace('Concurrency QA') as id`))
        .rows[0].id,
  );
  await db.query(
    `insert into public.memberships values($1,$2,'member'),($1,$3,'member')`,
    [ws, other, viewer],
  );
  const p = (
    await as(owner, () =>
      db.query(
        `insert into public.projects(workspace_id,name) values($1,'Concurrency QA') returning id`,
        [ws],
      ),
    )
  ).rows[0].id;
  await as(owner, () =>
    db.exec(
      `select public.set_project_assignment('${ws}','${p}','${other}','editor',0,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${ws}')) m where m->>'user_id'='${other}'));select public.set_project_assignment('${ws}','${p}','${viewer}','viewer',0,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${ws}')) m where m->>'user_id'='${viewer}'))`,
    ),
  );
  for (const kind of ["report", "request"]) {
    const table = kind === "report" ? "daily_reports" : "daily_requests";
    const id = (
      await as(owner, () =>
        db.query(
          `insert into public.${table}(workspace_id,project_id,report_date,weather,work_done,created_by) values($1,$2,current_date,'ยังไม่บันทึก','Original',$3) returning id`,
          [ws, p, owner],
        ),
      )
    ).rows[0].id;
    const read = async () =>
      (
        await db.query(
          `select row_version,expected_version,work_done from public.${table} where id=$1`,
          [id],
        )
      ).rows[0];
    const events = async () =>
      (
        await db.query(
          `select count(*)::int as n from public.document_events where document_id=$1`,
          [id],
        )
      ).rows[0].n;
    assert.equal((await read()).row_version, 1);
    checks++;
    const stale = (await as(other, read)).row_version;
    await as(owner, () =>
      db.query(
        `update public.${table} set work_done='First engineer',expected_version=$2 where id=$1`,
        [id, stale],
      ),
    );
    assert.deepEqual(await read(), {
      row_version: 2,
      expected_version: null,
      work_done: "First engineer",
    });
    checks++;
    const before = await events();
    await as(other, async () => {
      for (const input of [
        "expected_version=1",
        "expected_version=null",
        "expected_version=999",
      ]) {
        await assert.rejects(
          () =>
            db.exec(
              `update public.${table} set work_done='Lost update',${input} where id='${id}'`,
            ),
          { code: "40001" },
        );
        checks++;
      }
      await assert.rejects(
        () =>
          db.exec(
            `update public.${table} set work_done='No token' where id='${id}'`,
          ),
        { code: "40001" },
      );
      checks++;
      await assert.rejects(
        () =>
          db.exec(
            `update public.${table} set row_version=3,expected_version=2 where id='${id}'`,
          ),
        { code: "22023" },
      );
      checks++;
    });
    assert.equal((await read()).work_done, "First engineer");
    checks++;
    assert.equal(await events(), before);
    checks++;
    await as(viewer, async () => {
      assert.equal(
        (
          await db.query(
            `update public.${table} set work_done='Viewer',expected_version=2 where id=$1 returning id`,
            [id],
          )
        ).rows.length,
        0,
      );
      checks++;
    });
    // A fresh read permits an editor to save, preserving the original author.
    await as(other, () =>
      db.exec(
        `update public.${table} set work_done='Fresh edit',expected_version=2 where id='${id}'`,
      ),
    );
    assert.equal((await read()).row_version, 3);
    checks++;
    assert.equal(await events(), before + 1);
    checks++;
    // Trash + restore increments the version even though the state returns to draft.
    for (const action of ["trash", "restore"]) {
      const stamp = (
        await db.query(
          `select updated_at::text as stamp from public.${table} where id=$1`,
          [id],
        )
      ).rows[0].stamp;
      await as(owner, () =>
        db.query(
          `select public.change_document_state($1,$2,$3,$4,$5::timestamptz,null)`,
          [ws, kind, id, action, stamp],
        ),
      );
    }
    assert.equal((await read()).row_version, 5);
    checks++;
    await as(other, async () => {
      await assert.rejects(
        () =>
          db.exec(
            `update public.${table} set work_done='Before trash',expected_version=3 where id='${id}'`,
          ),
        { code: "40001" },
      );
      checks++;
    });
    // Same-transaction timestamps can tie; the monotonic version still changes.
    await as(owner, () =>
      db.exec(
        `begin;update public.${table} set expected_version=5,work_done='A' where id='${id}';update public.${table} set expected_version=6,work_done='B' where id='${id}';commit;`,
      ),
    );
    assert.equal((await read()).row_version, 7);
    checks++;
    await as(owner, async () => {
      await assert.rejects(
        () =>
          db.query(
            `insert into public.${table}(workspace_id,project_id,report_date,weather,work_done,created_by,row_version) values($1,$2,current_date-1,'ยังไม่บันทึก','Invalid version',$3,99)`,
            [ws, p, owner],
          ),
        { code: "22023" },
      );
      checks++;
    });
  }
}
await db.close();
console.log(
  `PASS: migration applied; ${checks} PostgreSQL/RLS assertions (tenant isolation, spoofing, viewer, storage, immutable identity, anonymous access).`,
);
