# Supabase DEV connection — 23 October 2026

**24 October: Daily Request added.** Applied additive `daily_requests` migration version `20261024023508` only in DEV. Owner/editor can prepare requests and export external-signature PDFs, viewers read/export. One request per project/work date; original reports unchanged. 89 local PostgreSQL/RLS assertions, full browser suite 10/10, build/TypeScript/targeted lint/model checks passed. Authenticated hosted roundtrip rolled back; Security Advisors `lints: []`. Hampton remains 3 reports, 6 photos, 0 requests. Details: DAILY-REQUEST.md. No web deployment.

**24 October: local direct PDF export verified.** Hampton report `5eff862e-bd86-4281-9141-cf03742119fe` (24 October, 043) now contains one not-working progress row and holiday note, saved in the live UI and read-only verified in DEV. Zero photos produce one A4 page with no empty photo page or browser headers/footers. Direct PDF button and export API verified; build/lint and browser 2/2 passed. No schema, RLS, Storage, Auth, billing or deployment changes. See DIRECT-PDF-EXPORT.md for runtime requirements and QA.

**Latest: materials table and simplified form complete.** Build/lint/model and browser 2/2 passed; PostgreSQL/RLS 48 assertions; two-real-account DEV material roundtrip and full isolation/storage tests passed; fixtures cleaned. Hampton saved/reloaded and 2-page PDF checked with all six photos. See MATERIALS-REPORT.md. No deployment.

Applied tested DEV migration `20261023154409_exclude_staff_workforce`: workforce totals exclude staff, preserve group subtotals and legacy manual reports. Security Advisors empty. Hampton name corrected, stored workers=39 and PDF man-hours=312. See WORKFORCE-NOTES-CORRECTION.md. No deployment.

## Current result — two-account verification completed

Both users confirmed email normally. On 23 October 2026 around 16:15–16:18 Asia/Bangkok, the real HTTP integration test passed in both company directions: owner create/read/update, cross-tenant project/report/photo reads and writes denied, membership self-escalation denied, Storage download/upload/overwrite/delete and signed URL creation denied to the other account. Verified owner object survives foreign deletion using Storage listing. Owners can upload/download/sign/delete their own files. Anonymous access denied.

Cleanup independently verified 0 test workspaces and 0 test objects remain, while 2 sample reports and both confirmed Auth accounts are preserved. Security Advisors: `lints: []`. Lint passed; only tests/docs changed, no new app build required. Source evidence: `LIVE-TEST-RESULT.json`; full report: `outputs/two-account-rls-report.md`. The earlier pending statuses below are historical and superseded by this result. No deployment, production access or billing change. Deleted completed `supabase-dev` automation.

One initial cleanup assertion expected a cached download URL to immediately disappear. Database confirmed deletion; the test now checks an empty Storage listing and failure to create a new signed URL. Full rerun passed. Existing cached URLs may briefly retain previously served content after owner deletion.

## Reference Daily Report layout

Applied additive migration `20261023085342_reference_daily_report` to this DEV project after verifying its identity and existing columns. Local migration filenames now match both recorded hosted versions. Added validated JSONB report_details and database-derived labor totals; existing report text and RLS policies preserved. Security Advisors returned no lints after the change.

Read `REFERENCE-REPORT.md` for the complete UI, print and test results. Retain the new sample report ID `bb91a19e-a0f0-4255-8c9a-3310e33a27b7` and its project/photo for user review, as well as the earlier sample report. Scheduled RLS test cleanup must remove only fixtures it creates itself. PDF: `outputs/daily-report-reference-layout.pdf`. No deployment.

## One-day report / Thai PDF QA

Completed a full sample day through the live UI using the first confirmed account: draft, reload, open edit, submit, attach PNG, reload and verify Storage image. Date 2026-10-23, workers 14, weather มีเมฆมาก; database confirms submitted status and 1 photo. The retained sample report ID is `6b0a0d40-37fa-4b3f-9e24-39b00f76e777`, available at http://localhost:3000/reports/6b0a0d40-37fa-4b3f-9e24-39b00f76e777 . **Keep this report and its company/project/photo for user review; do not delete it as part of the scheduled two-account test cleanup.**

Thai A4 PDF generated using captured report DOM and the app's print CSS: `outputs/daily-report-th-2026-10-23.pdf`. Both pages visually checked; 14 required text checks, embedded image, A4 and margin checks passed with ActualText-aware MuPDF extraction. Full QA: `outputs/daily-report-QA.md`. Data and illustrative image are explicitly marked as test content. No app code change or deployment.

## Latest update: leaked password protection enabled

The organization was verified as already on Pro. Enabled **Prevent use of leaked passwords** on SITE DAILY TH DEV through Supabase Dashboard → Authentication → Sign In / Providers → Email. Save returned “Successfully updated settings”; Attack Protection then displayed **ENABLED**. No billing plan, add-on, or paid service was changed. The feature is included for Pro and above: https://supabase.com/docs/guides/auth/password-security

Security Advisors re-run after saving returned `lints: []`. This supersedes the earlier disabled-protection warning recorded below. Screenshot evidence: `outputs/supabase-dev-password-protection.png`.

The second signup was retried once during this follow-up and still returned `email rate limit exceeded`; `welovecyclist@gmail.com` does not yet exist in Auth. Latest successful confirmation send was 23 October 2026 at **15:09:42 Asia/Bangkok**. Built-in email is limited to 2 emails/hour; increasing it requires custom SMTP or a Send Email hook: https://supabase.com/docs/guides/auth/rate-limits . The Dashboard email rate field is disabled. No custom email service or authentication bypass was configured. A sensible next retry is after **16:10 Asia/Bangkok**; this is an estimate, not a confirmed provider reset time. The user must then confirm the second email.

The complete live test now requires two registered accounts by default and creates a separate company for each. It checks isolation in both directions for projects, reports, photo metadata, file upload/download/deletion and signed URL creation. A delete attempt is verified by checking that the owner's file still exists. This expanded two-account test is syntax/lint checked but **has not run**, pending the second signup and confirmation. The first-account results below remain valid.

No deployment performed.

- Organization: siamkosi's org (`dnjromrofmczdoedqhhg`), explicitly selected by the user.
- New isolated project: SITE DAILY TH DEV
- Project ref: `hvcwskmqwvrjsrysllly`
- Region: Singapore (`ap-southeast-1`)
- API: https://hvcwskmqwvrjsrysllly.supabase.co
- Dashboard: https://supabase.com/dashboard/project/hvcwskmqwvrjsrysllly
- `.env.local` configured with the DEV publishable key only, ignored by Git. No service-role or production credentials used.
- Existing projects were listed for identification only. No schemas or data in those projects were accessed or changed.

## Verified

- Public schema was empty before applying the migration.
- Initial migration applied successfully, recorded remotely as `20261023080357_initial_schema` (local source file remains `20261023080357_initial_schema.sql`). Local migration filenames now match the recorded remote versions. Do not apply them again to this DEV project.
- Initial Security Advisors returned an empty lint list. After real Auth signup, a new Auth warning appeared: leaked password protection is disabled. See the latest status below.
- Live PostgreSQL RLS checks: owner reads their project; a different identity cannot read or insert cross-tenant projects. Test identities and rows were inside a transaction and fully rolled back.
- Production build succeeded with `.env.local` loaded. No deployment performed.

## Real integration results after email confirmation

The user confirmed the first account. Actual password login succeeded through both the Supabase SDK and the application's Login screen in Microsoft Edge.

Passed against live DEV services:

- Auth password login, workspace RPC, project and daily report creation through PostgREST.
- Authenticated PNG upload, photo metadata insert, byte-for-byte-size download check, signed URL HTTP 200.
- Anonymous Data API read and private Storage download denied.
- Browser Login → report read → upload photo → reload (photo persists) → delete photo → logout. No JavaScript page errors.
- Test images and metadata deleted. The labeled test workspace, report, project and membership were removed; the confirmed Auth account remains available. Storage query confirmed zero remaining objects under the test workspace path.
- Evidence screenshot: `outputs/live-dev-report.png` (test image is a tiny PNG fixture, not a construction photo).

Latest Security Advisor: `auth_leaked_password_protection` WARN. No database RLS warning was reported. Configure leaked password protection when the project's plan supports it; no billing plan was changed. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Outstanding second-account verification

Signup and normal email confirmation for `siamkosi@gmail.com` succeeded (user ID `f0eed677-bb05-4863-9b9a-30164206b61f`).

Signup for `welovecyclist@gmail.com` returned `email rate limit exceeded`. This second account has not been created. Do not repeatedly retry or disable email confirmation to bypass the limit. Retry once the provider permits sending, or configure a user-approved custom SMTP service if requested.

Generated test credentials are saved privately in the task's `work/dev-test-users.json`, outside the deliverable repository/archive. No tokens or passwords are included in this report. The opt-in `tests/live-integration.mjs` script reads credentials from an explicitly supplied private file and refuses any target other than this DEV project.

Two-account REST isolation and cross-tenant Storage denial through two real Auth sessions are **not yet verified**, because signup for the second address still returned the email rate-limit error on one retry after first-account testing. SQL-level cross-tenant RLS tests have passed, but do not replace these two-session HTTP checks. Email confirmation has not been disabled or bypassed.

No cost-confirmation prompt or price quote was returned by project creation. This report does not assert that the project is free of usage charges.


## Single-source report inputs — 23 October 2026

Removed duplicate weather/workers/work_done inputs. DEV migration 20261023162911_allow_unrecorded_weather allows an explicit unrecorded weather state. Existing report details and policies preserved. Saved Hampton through the live form, reloaded and checked: 39 workers, 312 man-hours, 3 progress rows, 6 photos, both shifts and submitted status. Build/lint/model passed; 2 browser tests and 42 PostgreSQL/RLS assertions passed. Security Advisors lints=[]. See SINGLE-SOURCE-REPORT.md. No deployment.
