# Company invitations and project access — rollout notes

This feature is developed locally on `codex/company-invitations-project-access`. No hosted migrations, deploy, real Auth users, emails, or company memberships were changed during development.

## Behavior

Company roles are Owner and Member. Owner controls all projects, creates projects and manages invitations/assignments. A Member receives Editor or Viewer separately for each assigned project. Unassigned projects, names, counts, documents, history, trash, covers, photo metadata/objects and PDFs are protected by PostgreSQL RLS. Company photo storage totals are Owner-only.

Owner opens Settings → member project assignments or email invitations. Before sending, review the email, projects and role. Existing members use assignment controls. New invitees follow the email link, verify/sign into the matching account and explicitly accept the pending company invitation. Membership and selected project grants are created in one database transaction. Signing in alone grants nothing. No new company needs to be created to accept.

Invitations last seven days. Resend retains the original expiry and grants. Cancel and create a new invitation to change an offer. Rate limits: 60 seconds per email/company, ten attempts per Owner/hour, thirty per company/hour and one hundred outstanding pending offers. A UUID request ID prevents duplicate mail on transport retry. Failed or uncertain deliveries remain visible without granting access; uncertain results must be checked before an explicit resend. `sent` means accepted by Auth, not confirmed Inbox delivery.

## Preparation before a separately authorized rollout

1. Use an isolated staging Supabase project and SMTP test mailbox to exercise real new-user and existing-user email links, delivery, expiry, account switching, cancellation and two-device acceptance. PGlite tests validate PostgreSQL semantics, not the hosted Auth/Storage HTTP services.
2. Review company membership and have Owner explicitly choose each existing non-owner's project assignments. The migration preserves every existing ID/document/file/history record, retains Owners and records previous roles in the audit. Legacy company-wide Editor/Viewer becomes Member with **no automatic grants**. New projects also grant no implicit member access.
3. Coordinate app and `20261024144405_company_project_access_and_invitations.sql` in a maintenance window; do not run only one version. Take a database backup and verify restore procedures. Run local verification and stage the exact build before production.
4. No service-role key or application SMTP password is needed. Server uses the existing public Supabase key with caller bearer for protected RPCs, and a **separate** nonpersisting public-key client for recipient OTP. Set the exact HTTPS `APP_ORIGIN` and matching public build/runtime Supabase URL/key.
5. Review Supabase email templates **Confirm signup** and **Magic Link**. `supabase/templates/auth-email.html` is a generic prepared template for both, using the normal `{{ .ConfirmationURL }}`. Subject: `ยืนยันอีเมลเพื่อเข้าสู่ SiteEN DAILY`. Applying templates is a separate hosted configuration step, not done by this feature. Preserve recovery/Google configuration. Email confirmation must remain enabled; anonymous identities cannot invite or accept.
6. Ensure `APP_ORIGIN/auth/callback` is allowlisted in Supabase Auth. Existing production callback remains suitable; this feature introduces no external redirect target. Supabase SDK consumes callback credentials, clears the URL and validates the Auth user; Google and email callbacks share the generic page.
7. After staging succeeds, coordinate deployment and Owner's explicit existing-member assignments. Test Hampton and an unassigned second project with Editor, Viewer, foreign-company Owner and zero-membership invitee, including PDF/images and focus revocation. Do not silently restore broad roles to fix missing access.

## Limits and rollback

Existing signed image URLs may remain usable until their existing expiry (up to one hour). Revocation blocks new authorized requests immediately; downloaded files cannot be recalled. On tab focus the UI refreshes permissions/data while preserving an allowed unsaved form, and clears inaccessible project state. A stale write is never retried using elevated access.

Assignment revocations keep versioned tombstones to prevent ABA/stale edits. Deleting company membership cascades assignment rows; append-only access history remains. Owner transfer, membership deletion UI, subscription/billing and platform administrator tools are outside this feature.

Rollback is a coordinated, separately reviewed operation using backups, preserved legacy role events and current assignment/invitation history. Do not roll back only the old app or restore broad permissions as a shortcut.

## Local verification and known follow-ups

Verification uses the pinned app dependencies, embedded PostgreSQL and mocked Auth/mail, plus `tests/invitation-concurrency.mjs` against a disposable PostgreSQL 17 Docker container with `--network none`, no host ports or volumes. The concurrency test creates/removes only its own randomly named container and synthetic database. It checks repeat acceptance, accept/cancel, resend/cancel, assignment version conflicts and exact quota/pending limits with independent connections.

Owner assignments are returned as one ordered JSON payload so PostgREST's record cap cannot silently label a granted project as unassigned. The gallery clears its resource when the permitted project set changes and filters cached metadata against the current set. Normal signed-URL renewal preserves filters and allowed unsaved report edits.

Two small follow-ups remain: a signed-in user whose initial invitation list is empty must reload to see a later invitation; and an interrupted delivery-record write may leave the stored email state as `sending`. Check the mailbox/status before an explicit resend. Neither grants project access before acceptance. These do not replace the separately required staging email/provider checks above.

Run the local checks from the repository root:

```text
npm run build
npm run typecheck
npm run lint
npm test
node tests/rls.mjs
node tests/project-access.mjs
node tests/invitation-api.test.mjs
node tests/live-document-write.test.mjs
node tests/report-model.mjs
node tests/invitation-concurrency.mjs
```

The final command requires a running Linux Docker engine and `postgres:17-alpine`; it never connects to the app's Supabase configuration. Browser tests use mocked Auth/REST/mail and the local PDF renderer. Do not run the separate live integration scripts against production for this feature's verification.

Verified locally 2026-10-24 after the independent review fix pass: build, TypeScript and ESLint passed; 68/68 browser/PDF scenarios passed, 291 legacy RLS assertions + 87 project/invitation assertions passed, 15 real multi-connection PostgreSQL assertions passed, six invitation API/SDK tests + three document SDK tests passed, and the report model checks passed. Both Important review findings have regression coverage that failed before the fix and passed afterward. The two small follow-ups above are deliberately deferred. No production validation or SMTP delivery is claimed for this undeployed feature.


## Production rollout — 2026-10-24

Deployed application image `siteen-daily:62c797a` to https://siteen.siamkosi.com on the existing Hostinger VPS. Supabase recorded the migration as `20261024144405_company_project_access_and_invitations`; the local filename now matches that authoritative version. Production migration history was preserved without direct edits. The schema transition and the explicitly authorized existing-member assignments were applied in one transaction.

Company 27 วิศวกรรม: siamkosi@gmail.com remains Owner; welovecyclist@gmail.com is Member with Editor assignments for Hampton by Hilton Sukhumvit 11 and Good Day More Bangmod. Other companies had no legacy non-owner memberships at preflight. No new members or Auth accounts were created during rollout.

The pre-change backup was scoped to this company's membership roles and the affected function/policy definitions. Business documents were checked with counts and deterministic checksums, not exported. Post-change checksums matched for both projects, three total reports, one request and six photo records. This is a scoped rollback snapshot, not a full database or Storage backup. Evidence stays outside Git under root-only VPS `/opt/siteen-daily/qa/62c797a/` and ignored local output.

Both production Confirm signup and Magic Link templates now use the prepared Thai template; Site URL and existing six redirect URLs were checked. Custom SMTP credentials were retained. Real invitation sending requires an explicitly chosen recipient and project/role; no invitation email was sent without that instruction.

Linux release checks passed before cutover: two-page Thai report/request PDFs, fonts, images, cancellation watermark, non-root/sandbox/seccomp and HTTP/API guards. After cutover HTTPS health/login returned 200, invitation anonymous 401, foreign Origin 403, PDF anonymous 401; Supabase Security Advisors returned no findings. Existing VPS services remained running. The old image/config snapshot is retained; rollback of permissions must still be reviewed as a coordinated operation.

A maintenance flag is checked only by the SiteEN nginx vhost at `/var/www/siteen-daily-maintenance.flag`. It was removed after the new image became healthy and business checksums matched. Do not store this flag under the root-only application directory: nginx workers cannot stat it there.
