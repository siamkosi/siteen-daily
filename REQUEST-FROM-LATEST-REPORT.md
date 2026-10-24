# Daily Request from latest Daily Report — 24 October 2026

Added **สร้างจาก Daily Report ล่าสุด — <project>** to Daily Request for each active project that the current owner/editor can edit. Hampton is supported without hardcoding its project ID. Latest means greatest report date within the current company/project, with created_at/id as deterministic tie breakers; drafts are identified as such. A project filter limits the displayed template choices. Projects without a report offer a blank request instead.

Click opens `/requests/new?project=<id>&fromReport=<report-id>` with a new, unsaved request form. The form shows the source number/date, links to the original report, and asks for a fresh work plan and start/finish times. Source must exist in the loaded current-company data and match the selected project; invalid/missing/cross-company references do not open a form. Viewers cannot create requests.

Copied into an independent clone:
- Project, document parties, requester/controller names, discipline and logos.
- DRQ document code and DRP → DRQ number conversion; revision resets to 0.

Cleared: labor/equipment/material rows and legacy resource text, actual work progress (one required blank planning row), weather observations, issues, solution, notes, tomorrow text, old request/source references, record ID, author and creation timestamp. Work date starts at today and is editable. No request is saved until the user fills a plan with start/finish times and saves; author/time/ID are generated normally on save. If today's request already exists, a notice links to it and the normal duplicate guard remains active.

This follows the later simplification request: only sections 01, 02 and 06 appear. Resource copying from the earlier version is superseded. Previously stored resources in existing requests are preserved on edit, while excluded from the form and PDF. Daily Report remains unchanged.

After saving, the request retains a link to the source Daily Report. Original report and photo data remain unchanged.

Validation:
- Build including TypeScript and targeted ESLint passed.
- Template browser regression passed: latest date wins over input order/created_at, other projects/companies excluded, header copied, new resource arrays empty, blank plan cannot save, edits stored as a new draft under the current author, source reports byte-for-byte unchanged, and invalid source IDs rejected. Existing hidden resources survive editing. Long plans export to multiple A4 pages without horizontal or vertical overflow.
- Existing complete Daily Request draft/edit/PDF/actual-report/future-date/duplicate/mobile workflow passed separately.
- Real Chrome session siamkosi / 27 วิศวกรรม is used to review the Hampton template. No real request is saved by this change.

Sample output: `output/pdf/daily-request-sample.pdf` and `output/pdf/daily-request-long.pdf`. No database migration, membership change or web deployment. Local server rebuilt/restarted only.
