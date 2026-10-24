// Isolated embedded PostgreSQL only: no network, real mail, or hosted data.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
let checks = 0;
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [owner,engineer,viewer,outsider,unverified] = [1,2,3,4,5].map(id);
const [company,foreignCompany,p1,p2,foreignProject] = [10,11,20,21,22].map(id);
const [r1,r2,q1,q2] = [30,31,32,33].map(id);
await db.exec(`create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb);
alter table storage.objects enable row level security; grant usage on schema public,storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;`);
const migrations = readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort();
const current = migrations.find(n=>n.includes('company_project_access_and_invitations'));
for(const name of migrations.filter(n=>n!==current)) await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'));
await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
('${owner}','owner@example.test',now()),('${engineer}','engineer@example.test',now()),('${viewer}','viewer@example.test',now()),('${outsider}','outsider@example.test',now()),('${unverified}','unverified@example.test',null);
insert into public.workspaces(id,name) values('${company}','Company A'),('${foreignCompany}','Company B');
insert into public.memberships values('${company}','${owner}','owner'),('${company}','${engineer}','editor'),('${company}','${viewer}','viewer'),('${foreignCompany}','${outsider}','owner');
insert into public.projects(id,workspace_id,name) values('${p1}','${company}','Hampton'),('${p2}','${company}','Hidden project'),('${foreignProject}','${foreignCompany}','Foreign project');
insert into public.daily_reports(id,workspace_id,project_id,report_date,weather,workers,work_done,created_by) values
('${r1}','${company}','${p1}',current_date,'แดดออก',1,'Work A','${owner}'),('${r2}','${company}','${p2}',current_date,'แดดออก',1,'Secret work','${owner}');
insert into public.daily_requests(id,workspace_id,project_id,report_date,weather,workers,work_done,created_by) values
('${q1}','${company}','${p1}',current_date,'ยังไม่บันทึก',1,'Plan A','${owner}'),('${q2}','${company}','${p2}',current_date,'ยังไม่บันทึก',1,'Secret plan','${owner}');`);
await db.exec(readFileSync(`supabase/migrations/${current}`,'utf8'));
async function as(user,fn){await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false)`);try{return await fn();}finally{await db.exec('reset role');}}
async function scalar(sql){return Object.values((await db.query(sql)).rows[0])[0];}
async function count(table,n){assert.equal(await scalar(`select count(*)::int from ${table}`),n);checks++;}
async function deny(sql,code){await assert.rejects(()=>db.exec(sql),e=>!code||e.code===code,sql);checks++;}
async function rpc(sql){return scalar(`select ${sql}`);}
assert.equal(await scalar(`select role from public.memberships where user_id='${engineer}'`),'member'); checks++;
await as(engineer,async()=>{await count('public.projects',0);await count('public.daily_reports',0);await count('public.daily_requests',0);await deny(`select public.company_photo_storage('${company}')`,'42501');await deny(`select public.list_company_members('${company}')`,'42501');});
await as(owner,async()=>{
  await count('public.projects',2);
  await db.exec(`select public.set_project_assignment('${company}','${p1}','${engineer}','editor',0);select public.set_project_assignment('${company}','${p1}','${viewer}','viewer',0);select public.set_project_assignment('${company}','${p2}','${engineer}','viewer',0);`);
});
await as(engineer,async()=>{
  await count('public.projects',2);await count('public.daily_reports',2);await count('public.daily_requests',2);
  const changed=await db.query(`update public.daily_reports set work_done='Updated',expected_version=row_version where id='${r1}' returning id`);assert.equal(changed.rows.length,1);checks++;
  const unchanged=await db.query(`update public.daily_reports set work_done='Forbidden',expected_version=row_version where id='${r2}' returning id`);assert.equal(unchanged.rows.length,0);checks++;
  await deny(`insert into public.projects(workspace_id,name) values('${company}','Not allowed')`,'42501');
  await deny(`select public.set_project_assignment('${company}','${p2}','${engineer}','editor',1)`,'42501');
  await deny(`select public.company_photo_storage('${company}')`,'42501');
});
await as(viewer,async()=>{await count('public.projects',1);await count('public.daily_reports',1);await count('public.daily_requests',1);assert.equal((await db.query(`update public.projects set name='Bad' where id='${p1}' returning id`)).rows.length,0);checks++;});
await as(owner,async()=>{
  await deny(`select public.set_project_assignment('${company}','${foreignProject}','${engineer}','editor',0)`);
  await deny(`select public.set_project_assignment('${company}','${p1}','${outsider}','editor',0)`);
  await deny(`select public.set_project_assignment('${company}','${p1}','${owner}','editor',0)`);
  await deny(`select public.set_project_assignment('${company}','${p1}','${viewer}','owner',1)`);
  await deny(`select public.set_project_assignment('${company}','${p1}','${engineer}','viewer',0)`,'40001');
  await db.exec(`select public.set_project_assignment('${company}','${p2}','${engineer}',null,1)`);
});
await as(engineer,async()=>{await count('public.projects',1);await count('public.daily_reports',1);await count('public.daily_requests',1);const events=await db.query('select * from public.document_events');assert(events.rows.every(e=>e.document_id!==r2&&e.document_id!==q2));checks++;});
// Covers and report objects use project authorization, not company membership.
const photo1=id(40),photo2=id(41),cover1=`${company}/${p1}/${id(42)}.jpeg`,cover2=`${company}/${p2}/${id(43)}.jpeg`;
const path1=`${company}/${p1}/${r1}/${photo1}.jpeg`,path2=`${company}/${p2}/${r2}/${photo2}.jpeg`;
await db.exec(`insert into public.photos(id,workspace_id,project_id,report_id,path) values('${photo1}','${company}','${p1}','${r1}','${path1}'),('${photo2}','${company}','${p2}','${r2}','${path2}');
insert into storage.objects(bucket_id,name) values('site-photos','${path1}'),('site-photos','${path2}'),('project-covers','${cover1}'),('project-covers','${cover2}');`);
await as(engineer,async()=>{await count('public.photos',1);await count('storage.objects',2);await deny(`insert into storage.objects(bucket_id,name) values('site-photos','${company}/${p2}/${r2}/${id(44)}.jpeg')`,'42501');});
await as(outsider,async()=>{await count('public.daily_reports',0);await count('public.photos',0);await count('storage.objects',0);await deny(`select public.list_project_assignments('${company}')`,'42501');});
// Invites never grant access until a verified matching user accepts.
const request=id(50),resend=id(51);
let invitation,version;
await as(owner,async()=>{
  await deny(`select public.prepare_company_invitation('${company}','new@example.test',array['${foreignProject}'::uuid],'editor','${id(49)}',null,null)`);
  await deny(`select public.prepare_company_invitation('${company}','new@example.test',array[]::uuid[],'editor','${id(48)}',null,null)`);
  const offer=await rpc(`public.prepare_company_invitation('${company}','  New+site@example.test ',array['${p1}'::uuid],'editor','${request}',null,null)`);
  invitation=offer.id;version=offer.row_version;assert.equal(offer.email,'new+site@example.test');assert.equal(offer.send,true);checks+=2;
  const repeat=await rpc(`public.prepare_company_invitation('${company}','new+site@example.test',array['${p1}'::uuid],'editor','${request}',null,null)`);assert.equal(repeat.send,false);checks++;
  await deny(`select public.prepare_company_invitation('${company}','new+site@example.test',array['${p1}'::uuid],'viewer','${request}',null,null)`);
  await db.exec(`select public.complete_company_invitation_delivery('${company}','${offer.attempt_id}','sent')`);
  await deny(`select public.prepare_company_invitation('${company}','new+site@example.test',array['${p1}'::uuid],'editor','${resend}','${invitation}',${version})`);
});
const recipient=id(6);
await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${recipient}','new+site@example.test',now())`);
await as(recipient,async()=>{
  await count('public.projects',0);await count('public.memberships',0);
  const pending=await rpc('public.list_my_company_invitations(null,null)');assert.equal(pending.items.length,1);assert.equal(pending.items[0].projects[0].name,'Hampton');checks+=2;
});
await as(viewer,async()=>{await deny(`select public.accept_company_invitation('${invitation}',${version})`,'42501');});
await as(recipient,async()=>{
  const accepted=await rpc(`public.accept_company_invitation('${invitation}',${version})`);assert.equal(accepted,company);checks++;
  assert.equal(await rpc(`public.accept_company_invitation('${invitation}',${version})`),company);checks++;
  await count('public.memberships',1);await count('public.projects',1);await count('public.daily_reports',1);
});
await as(owner,async()=>{
  await deny(`select public.prepare_company_invitation('${company}','new+site@example.test',array['${p1}'::uuid],'editor','${id(52)}',null,null)`);
  await deny(`select public.cancel_company_invitation('${company}','${invitation}',${version})`);
});
// Wrong/unverified addresses, cancellation, expiry, removed inviter, role spoofing.
async function make(email,n){
  // Advance the synthetic attempts past cooldown, without sleeping or real mail.
  await db.exec(`update private.invitation_send_attempts set created_at=now()-interval '2 minutes' where invitation_id in (select id from private.company_invitations where email='${email}')`);
  return as(owner,()=>rpc(`public.prepare_company_invitation('${company}','${email}',array['${p1}'::uuid],'viewer','${id(n)}',null,null)`));
}
const cancel=await make('unverified@example.test',60);
await as(unverified,()=>deny(`select public.accept_company_invitation('${cancel.id}',${cancel.row_version})`,'42501'));
await as(owner,()=>db.exec(`select public.cancel_company_invitation('${company}','${cancel.id}',${cancel.row_version})`));
await db.exec(`update auth.users set email_confirmed_at=now() where id='${unverified}'`);
await as(unverified,()=>deny(`select public.accept_company_invitation('${cancel.id}',${cancel.row_version})`));
const expired=await make('unverified@example.test',61);
await db.exec(`update private.company_invitations set expires_at=now()-interval '1 second' where id='${expired.id}'`);
await as(unverified,()=>deny(`select public.accept_company_invitation('${expired.id}',${expired.row_version})`));
const revoked=await make('unverified@example.test',62);
await db.exec(`update public.memberships set role='member' where workspace_id='${company}' and user_id='${owner}'`);
await as(unverified,()=>deny(`select public.accept_company_invitation('${revoked.id}',${revoked.row_version})`));
await db.exec(`update public.memberships set role='owner' where workspace_id='${company}' and user_id='${owner}'`);
await as(owner,()=>deny(`select public.prepare_company_invitation('${company}','x@example.test',array['${p1}'::uuid],'owner','${id(63)}',null,null)`));
await as(engineer,()=>deny(`select public.prepare_company_invitation('${company}','x@example.test',array['${p1}'::uuid],'viewer','${id(64)}',null,null)`,'42501'));
await as(recipient,()=>deny(`insert into public.memberships values('${foreignCompany}','${recipient}','owner')`,'42501'));
await as(owner,async()=>{await deny(`select public.set_company_member_role('${company}','${engineer}','editor','viewer')`,'42501');await deny(`delete from private.company_access_events`,'42501');});
// Access revoked on the next request, even with the same authenticated identity.
await as(owner,()=>db.exec(`select public.set_project_assignment('${company}','${p1}','${engineer}',null,1)`));
await as(engineer,async()=>{await count('public.projects',0);await count('public.daily_reports',0);await count('storage.objects',0);});
await db.exec('set role anon');await deny('select * from public.project_memberships','42501');await db.exec('reset role');
console.log(`PASS: ${checks} project isolation/invitation assertions; isolated PostgreSQL, no hosted writes or mail.`);
await db.close();
