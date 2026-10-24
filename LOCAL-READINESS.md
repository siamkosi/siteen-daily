# Local readiness — 24 October 2026

Workspace: `D:\Sandbox27\SiteEN`.

- Existing local production server on http://127.0.0.1:3000 belongs to this workspace; login page opened and verified in Codex.
- Development server started on http://127.0.0.1:3001 (3000 already occupied). Use this for ongoing source edits.
- Node 24.14.0 and npm 11.19.1; installed dependencies available.
- `.env.local` present with DEV host `hvcwskmqwvrjsrysllly.supabase.co` and configured publishable key. No credentials copied into this report.
- Build, lint, typecheck, report-model checks, 48 embedded PostgreSQL/RLS assertions, and 2/2 Playwright browser tests passed.
- Browser tests cover demo persistence, photos, next-day report, duplicate prevention, mobile layout and direct PDF downloads with/without photos.
- Test screenshots and PDFs now save within `test-results/qa/`, instead of the workspace parent. These are ignored generated artifacts.
- No hosted DEV data, Auth, schema, Storage policy, billing or deployment changes. Existing-account login and hosted data were not re-tested this run; previous evidence is in `DEV-CONNECTION.md` and `LIVE-TEST-RESULT.json`.
- Git has no commits and no remote. Current source exists locally but has no committed baseline yet.
- Older documentation refers to `outputs/` and parent-directory deliverables from the previous workspace. Those historical exports are not included here; current tests regenerated sample PDFs locally.

No deployment performed. `npm run build` creates local build output only.
