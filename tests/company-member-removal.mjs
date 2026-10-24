// Isolated PostgreSQL only. No real accounts, mail, hosted DB or Storage calls.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
let checks = 0;
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [owner, member, viewer, foreignOwner, secondOwner] = [1, 2, 3, 4, 5].map(
    id,
  ),
  [a, b, p1, p2, p3, pb, r1, q1, rb, photo] = [
    10, 11, 20, 21, 22, 23, 30, 31, 32, 40,
  ].map(id);
await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb);
alter table storage.objects enable row level security;grant usage on schema public,storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
for (const f of readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${member}','member@example.test',now()),('${viewer}','viewer@example.test',now()),('${foreignOwner}','foreign@example.test',now()),('${secondOwner}','second-owner@example.test',now());
insert into public.workspaces(id,name) values('${a}','Company A'),('${b}','Company B');
insert into public.memberships(workspace_id,user_id,role) values('${a}','${owner}','owner'),('${a}','${member}','member'),('${a}','${viewer}','member'),('${a}','${secondOwner}','owner'),('${b}','${foreignOwner}','owner'),('${b}','${member}','member');
insert into public.projects(id,workspace_id,name) values('${p1}','${a}','Hampton'),('${p2}','${a}','Good Day'),('${p3}','${a}','Previously revoked'),('${pb}','${b}','Other company');
insert into public.project_memberships(workspace_id,project_id,user_id,role,row_version) values('${a}','${p1}','${member}','editor',1),('${a}','${p2}','${member}','viewer',1),('${a}','${p3}','${member}',null,8),('${a}','${p1}','${viewer}','viewer',1),('${b}','${pb}','${member}','editor',1);
insert into public.daily_reports(id,workspace_id,project_id,report_date,weather,workers,work_done,created_by) values('${r1}','${a}','${p1}',current_date,'ยังไม่บันทึก',1,'Retained work','${member}'),('${rb}','${b}','${pb}',current_date,'ยังไม่บันทึก',1,'Other company work','${member}');
insert into public.daily_requests(id,workspace_id,project_id,report_date,weather,work_done,created_by) values('${q1}','${a}','${p2}',current_date,'ยังไม่บันทึก','Retained plan','${member}');
insert into public.photos(id,workspace_id,project_id,report_id,path) values('${photo}','${a}','${p1}','${r1}','${a}/${p1}/${r1}/${photo}.jpeg');
insert into storage.objects(bucket_id,name) values('site-photos','${a}/${p1}/${r1}/${photo}.jpeg'),('project-covers','${a}/${p1}/${id(41)}.jpeg');`);
async function as(user, fn) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${user}',false)`,
  );
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function scalar(sql) {
  return Object.values((await db.query(sql)).rows[0])[0];
}
async function rpc(sql) {
  return scalar(`select ${sql}`);
}
async function deny(sql, code) {
  await assert.rejects(
    () => db.exec(sql),
    (e) => !code || e.code === code,
    sql,
  );
  checks++;
}
async function count(table, n, where = "true") {
  assert.equal(
    await scalar(`select count(*)::int from ${table} where ${where}`),
    n,
  );
  checks++;
}
const preview = () =>
  as(owner, () =>
    rpc(`public.preview_company_member_removal('${a}','${member}')`),
  );
const remove = (v, user = member) =>
  `select public.remove_company_member('${a}','${user}','${v.membership_version}','${v.assignments_hash}')`;
let offer = await preview();
assert.equal(offer.email, "member@example.test");
assert.equal(offer.company_name, "Company A");
assert.equal(offer.projects.length, 2);
assert.ok(offer.membership_version);
assert.match(offer.assignments_hash, /^[a-f0-9]{32}$/);
checks += 5;
const roster = await as(owner, () =>
  rpc(`public.list_company_members_with_revisions('${a}')`),
);
const rosterMember = roster.find((m) => m.user_id === member);
assert.equal(rosterMember.membership_version, offer.membership_version);
assert.deepEqual(
  rosterMember.assignments.map((x) => [x.project_id, x.role, x.row_version]),
  [
    [p1, "editor", 1],
    [p2, "viewer", 1],
    [p3, null, 8],
  ],
);
checks += 2;
await count(
  "public.memberships",
  1,
  `workspace_id='${a}' and user_id='${member}'`,
); // Preview is read-only.
for (const u of [member, viewer, foreignOwner])
  await as(u, async () => {
    await deny(
      `select public.list_company_members_with_revisions('${a}')`,
      "42501",
    );
    await deny(
      `select public.preview_company_member_removal('${a}','${member}')`,
      "42501",
    );
    await deny(remove(offer), "42501");
  });
await as(owner, async () => {
  await deny(
    `select public.preview_company_member_removal('${a}','${owner}')`,
    "42501",
  );
  await deny(
    `select public.preview_company_member_removal('${a}','${secondOwner}')`,
    "42501",
  );
  await deny(remove(offer, owner), "42501");
  await deny(remove(offer, secondOwner), "42501");
  await deny(
    `select public.preview_company_member_removal('${b}','${member}')`,
    "42501",
  );
  await deny(
    `delete from public.memberships where workspace_id='${a}' and user_id='${member}'`,
    "42501",
  );
  await deny(
    `select private.company_member_assignment_snapshot('${a}','${member}')`,
    "42501",
  );
  await db.exec(
    `select public.set_project_assignment('${a}','${p1}','${member}','viewer',1,(select (m->>'membership_version')::uuid from jsonb_array_elements(public.list_company_members_with_revisions('${a}')) m where m->>'user_id'='${member}'))`,
  );
  await deny(remove(offer), "40001");
  await deny(
    `select public.remove_company_member('${a}','${member}',null,'${offer.assignments_hash}')`,
    "22023",
  );
});
offer = await preview();
const pending = id(50),
  accepted = id(51);
await db.exec(
  `insert into private.company_invitations(id,workspace_id,email,project_ids,role,invited_by,status,accepted_by,accepted_at) values('${pending}','${a}','member@example.test',array['${p1}'::uuid],'editor','${owner}','pending',null,null),('${accepted}','${a}','member@example.test',array['${p1}'::uuid],'editor','${owner}','accepted','${member}',now());`,
);
async function business() {
  return scalar(
    `select jsonb_build_object('projects',(select jsonb_agg(to_jsonb(t) order by id) from public.projects t),'reports',(select jsonb_agg(to_jsonb(t) order by id) from public.daily_reports t),'requests',(select jsonb_agg(to_jsonb(t) order by id) from public.daily_requests t),'photos',(select jsonb_agg(to_jsonb(t) order by id) from public.photos t),'events',(select jsonb_agg(to_jsonb(t) order by id) from public.document_events t),'objects',(select jsonb_agg(to_jsonb(t) order by id) from storage.objects t))`,
  );
}
// A rejected confirmation must not cancel pending offers or partially remove access.
await as(owner, () =>
  deny(remove({ ...offer, assignments_hash: "0".repeat(32) }), "40001"),
);
assert.equal(
  await scalar(
    `select status from private.company_invitations where id='${pending}'`,
  ),
  "pending",
);
checks++;
for (const fn of [
  "public.preview_company_member_removal(uuid,uuid)",
  "public.remove_company_member(uuid,uuid,uuid,text)",
  "public.list_company_members_with_revisions(uuid)",
  "public.set_project_assignment(uuid,uuid,uuid,text,integer,uuid)",
]) {
  assert.equal(
    await scalar(`select has_function_privilege('anon','${fn}','EXECUTE')`),
    false,
  );
  checks++;
}
const before = await business();
await as(owner, () => db.exec(remove(offer)));
assert.deepEqual(await business(), before);
checks++;
await count("auth.users", 1, `id='${member}'`);
// Retaining the Auth author also allows Owner to continue editing the old report.
await as(owner, async () => {
  const r = await db.query(
    `update public.daily_reports set expected_version=row_version,work_done=work_done where id='${r1}' returning id`,
  );
  assert.equal(r.rows.length, 1);
  checks++;
});

await count(
  "public.memberships",
  0,
  `workspace_id='${a}' and user_id='${member}'`,
);
await count(
  "public.project_memberships",
  0,
  `workspace_id='${a}' and user_id='${member}'`,
);
await count(
  "public.memberships",
  1,
  `workspace_id='${b}' and user_id='${member}'`,
);
assert.equal(
  await scalar(
    `select status from private.company_invitations where id='${pending}'`,
  ),
  "cancelled",
);
assert.equal(
  await scalar(
    `select status from private.company_invitations where id='${accepted}'`,
  ),
  "accepted",
);
checks += 2;
await as(owner, async () => {
  await deny(remove(offer), "40001");
  const history = await rpc(
    `public.list_company_access_events('${a}',null,null)`,
  );
  const e = history.items.find((e) => e.action === "company_member_removed");
  assert.equal(e.details.email, "member@example.test");
  assert.equal(e.details.user_id, member);
  assert.equal(e.details.project_ids.length, 2);
  assert.equal(e.details.removed_assignments.length, 3);
  checks += 4;
});
await as(member, async () => {
  await count("public.projects", 0, `workspace_id='${a}'`);
  await count("public.projects", 1, `workspace_id='${b}'`);
  await count("public.daily_reports", 0, `workspace_id='${a}'`);
  await count("public.daily_requests", 0, `workspace_id='${a}'`);
  await count("public.photos", 0, `workspace_id='${a}'`);
  await count("public.document_events", 0, `workspace_id='${a}'`);
  await count("storage.objects", 0);
  await deny(
    `select public.accept_company_invitation('${accepted}',1)`,
    "40001",
  );
  await deny(
    `select public.accept_company_invitation('${pending}',1)`,
    "40001",
  );
});
await as(viewer, () => count("public.daily_reports", 1, `workspace_id='${a}'`));
// New membership incarnation protects against stale removal after a legitimate rejoin.
const fresh = await as(owner, () =>
  rpc(
    `public.prepare_company_invitation('${a}','member@example.test',array['${p1}'::uuid],'editor','${id(60)}',null,null)`,
  ),
);
await as(member, () =>
  rpc(`public.accept_company_invitation('${fresh.id}',1)`),
);
const rejoined = await preview();
assert.notEqual(rejoined.membership_version, offer.membership_version);
checks++;
await as(owner, () =>
  deny(
    remove({ ...rejoined, membership_version: offer.membership_version }),
    "40001",
  ),
);
await count(
  "public.memberships",
  1,
  `workspace_id='${a}' and user_id='${member}'`,
);
// An old role-change dialog must not grant access after removal/rejoin (ABA).
await as(owner, () =>
  deny(
    `select public.set_project_assignment('${a}','${p1}','${member}','viewer',1)`,
    "40001",
  ),
);
await as(owner, () =>
  deny(
    `select public.set_project_assignment('${a}','${p1}','${member}','viewer',1,'${offer.membership_version}')`,
    "40001",
  ),
);
await as(owner, () =>
  db.exec(
    `select public.set_project_assignment('${a}','${p1}','${member}','viewer',1,'${rejoined.membership_version}')`,
  ),
);
assert.equal(
  await scalar(
    `select role from public.project_memberships where workspace_id='${a}' and project_id='${p1}' and user_id='${member}'`,
  ),
  "viewer",
);
checks++;
// A role change to Owner wins over an already-open confirmation.
await db.exec(
  `update public.memberships set role='owner' where workspace_id='${a}' and user_id='${member}'`,
);
await as(owner, () => deny(remove(rejoined), "42501"));
await db.exec(
  `update auth.users set email_confirmed_at=null where id='${owner}'`,
);
await as(owner, () =>
  deny(
    `select public.preview_company_member_removal('${a}','${viewer}')`,
    "42501",
  ),
);
await db.exec("set role anon");
await deny(
  `select public.preview_company_member_removal('${a}','${member}')`,
  "42501",
);
await db.exec("reset role");
console.log(
  `PASS: ${checks} company member removal assertions; documents, photos, storage, Auth and history retained; no hosted calls.`,
);
await db.close();
