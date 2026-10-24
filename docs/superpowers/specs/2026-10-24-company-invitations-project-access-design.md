# Company invitations and project access

Status: approved by the human on 2026-10-24 for local development through verification. Hosted migration, deployment, real invitations, and live membership changes remain out of scope.

## สรุปสำหรับตรวจแบบ

- Owner เห็นทุกโครงการในบริษัทของตน และเชิญอีเมลพร้อมเลือกโครงการและบทบาท editor/viewer ได้
- ผู้รับกดลิงก์ยืนยันอีเมล แล้วกดยอมรับคำเชิญก่อนจึงได้สิทธิ์ ทั้งบัญชีใหม่และบัญชีเดิมใช้ได้
- สมาชิกทั่วไปเห็นเฉพาะโครงการที่ได้รับมอบหมาย คนเดียวรับผิดชอบหลายโครงการหรือมีบทบาทต่างกันในแต่ละโครงการได้
- Owner เพิ่ม/เปลี่ยน/ถอนสิทธิ์รายโครงการได้ ไม่สามารถเชิญเป็น Owner หรือเปลี่ยน Owner ผ่านหน้านี้
- เสนอให้คำเชิญมีอายุ 7 วัน ส่งซ้ำและยกเลิกได้ ลิงก์เข้าสู่ระบบในอีเมลยังมีอายุสั้นแยกจากอายุคำเชิญ
- เมื่อเปิดใช้ในอนาคต สมาชิก Editor/Viewer เดิมต้องได้รับมอบหมายโครงการจาก Owner ก่อน ไม่ให้สิทธิ์ทุกโครงการอัตโนมัติ และไม่ลบข้อมูลเดิม
- รอบนี้พัฒนาและทดสอบในเครื่องเท่านั้น ไม่ deploy ไม่ย้ายฐานข้อมูลเว็บจริง ไม่ส่งคำเชิญจริง และไม่เปลี่ยนสิทธิ์สมาชิกจริง

Builder review: completed; no material unanswered questions identified. Human approved the design and continuous inline execution without another plan approval.

## Intent and confirmed requirements

The first customer is 27 วิศวกรรม, which has multiple projects. Site Engineers must see and edit only projects assigned to them, including the related Daily Requests, Daily Reports, photos, and PDFs. The user explicitly selected visibility restricted to assigned projects. Future customers must use the same model with their own independent companies and owners.

The owner must be able to invite an email address, select projects and editor/viewer access, and manage existing members from the website. The current request is development only: do not deploy or apply migrations to the existing hosted database, which now serves the live website despite its DEV name. Do not send real mail or create real accounts while developing.

## Current system and scope

Company membership currently carries owner/editor/viewer, and private.has_access checks only company access. That gate is used by projects, documents, lifecycle/history, images, covers, and storage summaries. The browser also uses a company-wide canEdit flag. Updating only the invitation form would leave the isolation requirement unmet.

Existing owner member management is a guarded private SECURITY DEFINER function behind a public SECURITY INVOKER wrapper. Keep this limited pattern, with an empty search_path and explicit grants, for narrowly scoped membership mutations. Do not add a service-role key to the client or use a privileged key to read document data.

## Approaches

1. **Recommended proposal: Supabase email link plus explicit acceptance.** Store a pending company invitation, send an Auth Magic Link through the already configured Supabase SMTP, and show pending invitations after verified login. The same flow handles new accounts and existing accounts. No new application SMTP password or Auth admin key is needed. Supabase may prepare a new Auth account when the email is sent; this does not create company membership.
2. **Alternative: custom invitation email followed by ordinary signup/login.** The recipient first sets up or signs into their account and then accepts the invitation. This needs a server-side email sender and its own SMTP credentials or another provider integration; the SMTP password in hosted Supabase is not available for the application to reuse.

The human asked for a recommendation, received approach 1, and confirmed assigned-project-only visibility. Approach 1 and the remaining defaults below are proposed for approval, not recorded as choices the human explicitly made.

## Proposed user experience

### Owner

Under Company settings, show **Members and invitations**:

- **Invite member**: email, one or more projects belonging to the selected company, role editor/viewer, a concise preview, and a deliberate Send invitation button. One selected role applies to the selected projects initially; individual project roles can be changed later.
- **Pending invitations**: invited email, project names, roles, expiry, sender, send status, Resend and Cancel. Distinguish pending/sending, send failed, waiting for acceptance, accepted, cancelled, and expired. A successful provider request means accepted for sending, not delivery to the recipient's inbox.
- **Existing members**: company owner versus ordinary member, with project assignments and editor/viewer roles per project. Owner can add/remove assignments and change their roles with confirmation. They cannot promote anyone to Owner or change their own ownership here.
- If the invited email already belongs to a member of this company, do not send another invitation or silently change access. Direct the owner to Manage project assignments instead.
- Only Owner creates company projects. Project Editors can edit metadata for their assigned projects, but cannot move projects between companies or manage members, invitations, or assignments.

### Recipient

1. Receive a Supabase Auth email from the configured SiteEN DAILY sender and open its login link.
2. Auth validates the link, returns through the existing /auth/callback endpoint, validates the user, removes credentials from the address bar, and opens the app. Callback UI must describe general sign-in rather than only Google.
3. Show **Invitations for this email** independently of company membership, including for a user with no companies. Display company name, assigned projects and roles, expiry, and an explicit Accept invitation button. Display a safe way to sign into a different account when needed.
4. Before acceptance, no projects, documents, photo URLs, or PDFs of that company are available. Invitation previews expose only their own selected project names, not full project records.
5. On acceptance, atomically create ordinary company membership and the selected project assignments. Select the accepted company and show only authorized projects. Do not create a new company for the recipient.
6. A user can be Owner in one company and an assigned Editor or Viewer in another; the UI offers a company switcher only for memberships they hold.

Ordinary email/password and Google sign-in remain available. A new user who entered via an email link can subsequently set a password through the existing recovery flow; never require an owner or assistant to know it.

## Domain model and permission matrix

Separate company-level membership from project-level access:

- Company membership roles become owner/member; editor/viewer move to project assignments.
- A project assignment references company, project, user, and editor/viewer. All references must refer to the same company, and the user must be a member of it.
- Invitations reference company, normalized target email, selected project grants, inviting owner, status, timestamps, delivery attempt state, and revision. Derive actors and time on the server.
- Company/project access changes and invitation transitions produce append-only audit events scoped to that company and visible to its Owner.

| Action | Company Owner | Assigned Editor | Assigned Viewer | Unassigned member |
| --- | --- | --- | --- | --- |
| See project, reports, photos, PDF | All own-company projects | Assigned project | Assigned project | No |
| Edit project metadata/documents/photos | Yes | Assigned project | No | No |
| Create projects | Yes | No | No | No |
| Invite/manage members and assignments | Yes | No | No | No |
| View full company storage totals/set quota | Yes | No | No | No |
| Trash drafts | Any company draft | Own draft in assigned project | No | No |
| Restore drafts/cancel submitted documents | Existing Owner rules | No | No | No |

Owner-only management is scoped to the selected company, never a platform-wide capability. Project Viewer is read-only even if the same person is Editor elsewhere.

## Invitation and email lifecycle

Builder defaults proposed for approval:

- Invitations expire after 7 days using database time. Auth email links retain their separately configured short lifetime (currently normally one hour); do not extend token lifetimes to seven days. A recipient with an expired login link can use ordinary verified login to see an unexpired invitation, or request another sign-in link. The UI must explain this distinction.
- Normalize email by trim/lowercase only; do not strip Gmail plus suffixes or dots. Verify against the current Auth user's verified email from authoritative Auth state, not editable user_metadata or an email supplied by the browser.
- Only one active invitation per company and normalized email. Repeated requests use idempotency and do not create duplicate grants or silently change a pending offer.
- Resend requires the owner, keeps the same offered projects/roles and original membership invitation expiry, and respects a 60-second per-recipient cooldown. An expired invitation needs a deliberate new offer.
- Editing an offer requires cancelling it and creating a new one. A cancelled or expired invitation cannot be accepted.
- Before sending, validate the caller with Auth and recheck ownership in the database. Cap email attempts at 10 per hour per Owner and 30 per hour per company, including failed attempts. Limit pending invitations to 100 per company and paginate lists.
- The HTTP endpoint requires the exact configured Origin, a verified non-anonymous bearer identity, bounded JSON, and company-scoped authorization before making any email request. Redirect only to the configured app origin and existing exact callback path, never a client-supplied host or next URL.
- Use a separate non-persisting public-key Supabase Auth client for signInWithOtp; do not attach the Owner's bearer token to the recipient sign-in request. Keep document access and role changes under caller RLS/RPC checks.
- The application supplies a local proposed Auth email template for clear generic SiteEN DAILY sign-in/invitation wording. Do not change hosted templates or expose company/project details from untrusted Auth metadata. Configuration changes needed for staging are documented for later application.
- Track email attempts and request idempotency in the database. If a provider accepts mail but recording completion fails, show an unknown send result and require an explicit resend after cooldown; do not automatically send mail again or report inbox delivery.
- Acceptance locks and validates the current active invitation, verified current email, and inviter still being Owner. Projects must still exist in that company. If company membership or a conflicting assignment appeared concurrently, fail with a reload/review message; do not overwrite newer access or create partial grants. A repeat acceptance by the already successful recipient returns an already accepted result without duplicating membership.
- Cancelling an unaccepted offer does not remove existing memberships. Removing access after acceptance is an explicit project-assignment operation.

## Enforcement across the whole application

Add a project access predicate that permits own-company Owner or an explicitly assigned company member, and requires editor for writes. Company membership alone must never satisfy project access. Apply this consistently to:

- Project list/details/covers and dashboard counts, cards and reminders.
- Daily Requests and Reports: reads, writes, creation from a template, paired documents, duplicate/date checks, lifecycle guards, trash and history snapshots.
- Photo metadata and both storage buckets: full images, thumbnails, project covers, upload/delete, galleries and date filters.
- PDF authorization, admission and cancellation checks; an arbitrary project/document ID must not bypass assignments.
- Storage summaries: the complete company breakdown and quota remain Owner-only. Do not leak hidden project names or totals through summary RPCs.
- Any SECURITY DEFINER helper/RPC that currently relies on company-wide has_access, including checks used by triggers. Client controls reflect project permissions but are not the security boundary.

Changing or removing an assignment applies to the next database/API request, including for a still-signed-in user. Refresh visible assignments on focus and after management actions, clear inaccessible project state, and never retry a denied save using elevated access. Existing document version-conflict protection remains.

Already delivered files cannot be recalled. Previously issued private signed image URLs retain their existing expiry (up to one hour); revoking assignment prevents new URLs immediately but does not invalidate issued URLs. Do not claim instant revocation of already downloaded or signed files.

## Existing members and rollout

This is a deliberate change from company-wide editor/viewer access:

- Keep all existing user IDs, company IDs, projects, documents, attachments, and document history.
- Retain Owner memberships. Normalize old non-owner membership roles to member in a staged, transactional migration, preserving a role snapshot in the access migration audit.
- Do not assign old Editors/Viewers to all projects automatically. They initially have no project access until Owner assigns projects. In particular, do not silently decide which live projects an existing member should receive.
- Replace the old company-wide editor/viewer toggle with project assignment management. Membership badges must not imply broad Editor access.
- New invitations grant membership and project assignments together only after acceptance.
- Build and test this migration locally against synthetic data. The existing hosted Supabase project now serves production: do not apply it there in this task.
- Later deployment must coordinate app and migration versions in a maintenance window and have Owner assignment choices ready. Do not roll back only the old application or restore broad permissions as a shortcut. Rollback is a separately reviewed operation using the preserved membership role snapshot and current access history.

## Verification and acceptance criteria

1. Real embedded PostgreSQL tests using synthetic users and at least two companies and two projects per company: Owner/Editor/Viewer/unassigned/anonymous matrix and direct-table, direct-RPC and Storage path attacks.
2. A user assigned Hampton cannot obtain Good Day project names, counts, reports, requests, covers, photo URLs, history, trash contents, templates, summary data, or PDFs, including by guessed IDs. An Owner of another company cannot grant or read anything in 27 วิศวกรรม.
3. Invitation tests: existing/new Auth users, unconfirmed/wrong/changed email, duplicate invites, cancelled/expired offers, removed owner, foreign/deleted projects, invalid roles, empty project selection, conflicting acceptance and resend races, delivery failure/timeout/unknown outcome, quotas and exact-Origin rejection. Confirm no access exists before acceptance.
4. Existing member assignment tests: grant/change/revoke, stale revision rejection, company owner unchanged, viewers cannot escalate, no implicit access to newly created projects, and a revoked session loses subsequent API access.
5. Browser tests on desktop/mobile with mocked Auth/email: Owner sends/manages offers, recipient accepts without creating another company, pending invitations are visible to an account with zero memberships, wrong account is blocked, failed sends are clear, project navigation is restricted, and two different project roles behave correctly.
6. Preserve the existing report/request, PDF, photo renewal, lifecycle and optimistic save-conflict regression suites. Run build, typecheck, lint, local RLS and SDK checks. No tests may send real mail or mutate hosted data.
7. Record local results and explicitly leave real SMTP acceptance and multi-device staging checks for an isolated staging environment. Do not claim production validation for undeployed code.

## Out of scope

Deployment, hosted migrations, real invitations/accounts, live member changes, Owner transfer, billing/subscriptions, additional admin roles, project sub-teams, SSO provider changes, and a platform support console. Future SaaS companies use the same isolated company model; commercial onboarding can be added separately.

## Builder decisions left open

Exact table/RPC/component names, module boundaries, error codes and copy, cursor shape, indexes, and test helper organization. Follow the pinned dependency versions and existing Next.js guides. Prefer no new dependency or service secret for the recommended flow.

## References

- Supabase passwordless email and new-account behavior: https://supabase.com/docs/guides/auth/auth-email-passwordless
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase redirect allowlist: https://supabase.com/docs/guides/auth/redirect-urls
- Current code: src/components/company-members.tsx, src/components/site-app.tsx, src/components/oauth-callback.tsx, src/lib/server/pdf-auth.ts, supabase/migrations.
