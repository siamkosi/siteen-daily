# Company invitations and project access implementation plan

> For agentic workers: use superpowers:executing-plans. The human approved inline execution through verification without further plan approval.

**Goal:** Owners invite members and manage editor/viewer assignments while users see only assigned projects.
**Architecture:** Company owner/member membership, guarded per-project assignments and invitation RPCs, an Origin/auth guarded email endpoint using Supabase OTP, and client controls reflecting RLS.
**Tech stack:** Existing pinned Next.js/React/Supabase, PostgreSQL migrations, PGlite and Playwright.
**Spec:** ../specs/2026-10-24-company-invitations-project-access-design.md (approved by human 2026-10-24).

## Global constraints

- Local development only; no live migrations, deployment, real mail, accounts, or membership changes.
- Existing users, companies, documents and files retained; old non-owners become members with no implicit project assignments.
- No service-role key or new SMTP secret. Server Auth requests never carry the Owner token into recipient OTP requests.
- Seven-day invitations; 60-second resend cooldown; 10 attempts/owner/hour, 30/company/hour, 100 pending/company.
- Owner only project creation and administration; project Editor/Viewer rights apply to every document/photo/PDF surface.

## Review focus

- Forgotten SECURITY DEFINER aggregate/history/storage paths leaking hidden projects.
- Expired/cancelled/wrong-email offers and acceptance races granting partial access.
- Provider timeout or completion failure causing duplicate mail or a false success message.
- Unassigned or revoked sessions retaining actionable UI or server access.
- Existing browser fixtures treating company Editor as universal project access.

## Task 1: Database access and invitations

Files: new migration via Supabase CLI; tests/project-access.mjs; tests/rls.mjs.
Interfaces: project_memberships and project access predicate; list_company_members/list_project_assignments/set_project_assignment; prepare_company_invitation/complete_company_invitation_delivery/list_company_invitations/list_my_company_invitations/accept_company_invitation/cancel_company_invitation; append-only access audit.

- [ ] Write synthetic PostgreSQL tests: owner/member/editor/viewer/unassigned/foreign user, read/write/Storage/history/summary isolation, migration preserves old membership without broad access.
- [ ] Observe RED before implementing migration.
- [ ] Implement SQL, private guarded functions plus invoker RPCs, RLS, actor/clock/role/version validation, invitation quota/idempotency/acceptance.
- [ ] Test duplicate/cancelled/expired/unverified/wrong-email/concurrent and failed-delivery transitions; retrofit legacy test fixtures with explicit assignments.
- [ ] Run both PostgreSQL suites to GREEN and commit.

## Task 2: Email API

Files: src/lib/server/invitation-handler.ts, invitation-auth.ts; src/app/api/company-invitations/route.ts; tests/invitation-api.test.mjs.
Consumes Task 1 RPCs; produces guarded POST API using a separate public-key OTP sender and exact /auth/callback redirect.

- [ ] Tests RED: origin/auth/JSON bounds/role/payload rejection, owner authorization before send, retry/idempotency, 429, delivery failure/unknown outcome and safe logs.
- [ ] Implement service-injected handler/Auth adapter and route with no-store, bounded timeouts and no secret logging.
- [ ] Tests GREEN; prepare generic Auth invitation/login email template and configuration notes without modifying hosted services.

## Task 3: Web UI and project permissions

Files: company-members.tsx, company-invitations.tsx, pending-invitations.tsx, project-access.ts, site-app.tsx, types.ts, oauth-callback.tsx, related project/report controls and browser fixtures.
Consumes Task 1 RPCs and Task 2 endpoint; produces Owner management and recipient acceptance with company reload/selection.

- [ ] Browser tests RED: owner invite preview/send/resend/cancel, assignment edit/revoke, no-owner controls, unassigned account accepts without creating a company.
- [ ] Replace company-wide editor/viewer badges with Owner/member and per-project roles; guard every write control/template/default project.
- [ ] Owner-only full storage summary and project creation; refresh assignments on focus and clear denied data without retrying an unsaved write.
- [ ] Generic callback labels, pending invitations even with zero companies, existing Google/password flows preserved.
- [ ] Desktop/mobile tests GREEN with mocked mail and Auth only.

## Task 4: Whole feature verification and review

- [ ] Build, typecheck, lint, all browser tests, both PostgreSQL suites, SDK/API/model tests and formatting.
- [ ] Inspect rendered local Owner and recipient UI, no relevant console errors or overflow.
- [ ] Fresh-context whole-branch review required by executing-plans; fix material findings with regression tests and rerun relevant checks.
- [ ] Document local results and production rollout requirements, including explicit existing-member assignments and signed-URL expiry.
- [ ] Commit verified feature locally, leave reviewable branch and local app; no push/deploy/live changes.
