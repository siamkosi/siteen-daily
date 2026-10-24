# Daily Request — 24 October 2026

**Current form:** Daily Request has only **01 ข้อมูลทั่วไป**, **02 เอกสาร / ผู้ขอ** and **06 แผนงานขออนุมัติ**. Each plan item contains a description, start time and finish time. Personnel, equipment, materials, quantities, weather, shift selection, risks and notes are not requested. Daily Report retains its full form.

Routes are `/requests`, `/requests/new`, and `/requests/<id>`. Daily Request uses document code DRQ, work date (including future dates), document parties and requester/controller names. A separate A4 request layout displays only general/document information and the work/start/finish table, with external signature blocks. Long plans continue across pages with repeated headers. A finish time earlier than the start is labeled as the following day; identical or incomplete times cannot save.

**สร้างจาก Daily Report ล่าสุด** copies project and document information into a new unsaved form, then requires a new plan and times. It no longer copies resource rows into new requests. Existing requests keep their previously stored resource and issue data when editing, but these fields are hidden in both the request form and PDF. No schema migration or live data rewrite is needed. Details: [REQUEST-FROM-LATEST-REPORT.md](REQUEST-FROM-LATEST-REPORT.md).

## Daily workflow

1. Site Engineer prepares Daily Request before starting work. Save draft, edit, then mark submitted and export the PDF.
2. Send the PDF to the work controller for external signature. Submitted means a stored status only: it neither emails the document nor records approval. The PDF has approve/reject/request-changes choices for the controller to complete externally.
3. After work, prepare Daily Report with actual quantities, hours, issues and photos. Each active project is shown in the dashboard's daily document checklist; missing/draft/submitted states are displayed separately for Request and Report.

Request and Report are paired by company, project and work date. Links open the counterpart when it exists. “Create Daily Report from this request” keeps task/resource names and document parties but clears planned labor counts/hours, equipment counts/hours, work/material quantities, weather, risks and notes before actual entry. It creates a draft form, not an automatically saved report. The report references the source request; existing same-day reports are opened rather than duplicated. Future requests cannot start an actual report before their work date.

## Data and permissions

- Additive DEV migration `20261024023508_daily_requests.sql`, applied only to SITE DAILY TH DEV `hvcwskmqwvrjsrysllly`. Local filename matches hosted version. Do not apply twice.
- Separate `daily_requests` table preserves original reports/photos. `report_date` is the planned work date to share the existing typed document form. One request per project/date; one corresponding report remains enforced independently.
- RLS: owners/editors can read/create/update within their company; viewers read/export only; anonymous access denied. Composite parent foreign key denies cross-company project references; author/identity are immutable; shared report/material validators and workforce derivation run in the database. No approval status can be set via request status.
- No membership, role, Auth configuration, billing or web deployment changes.

## Validation

- Build including TypeScript and targeted ESLint passed; report-model checks passed.
- Embedded PostgreSQL/RLS: 89 assertions passed, including request creation on future dates, duplicate prevention, cross-company/spoofed-author/identity/invalid-details/approval-status rejection, editor write and viewer/anonymous restrictions.
- Full browser suite: 11/11 passed after form simplification. Workflow covers the three sections, required plan/times, draft → reload/edit → submitted → real PDF download → create full actual report → paired links → duplicate rejection → overnight/future request → mobile no page overflow. The template regression also verifies hidden legacy resource preservation and long-plan A4 pagination. Other report/PDF/auth/member/default-company tests remain passing.
- Fixed sidebar overflow exposed by adding the extra menu item, preserving access to logout on short screens. A4 sample PDFs are rendered for visual review; request output has the three-column work/time table and external signatures, without resource totals or photo pages.
- After the final text-wrapping adjustment, both request browser regressions passed again. Visually checked all pages of the one-page sample and four-page long-plan PDF; extracted text verifies the times, final work text and absence of resource headings. Chrome shows Hampton in 27 วิศวกรรม with only sections 01/02/06. Screenshot: `output/pdf/daily-request-simple-form.png`. Local server on port 3000 serves the final build.
- Hosted DEV authenticated request insert/submit/read was exercised inside a transaction and rolled back. Workers derived as expected. Security Advisors: `lints: []`.
- Real signed-in Chrome account siamkosi opened the 27 วิศวกรรม request list and new Hampton form. No request saved in the user's project. Verified existing Hampton remains 3 reports and 6 photos, with 0 requests after rollback.

Sample output `output/pdf/daily-request-sample.pdf` uses clearly labeled fictional QA data; it is not a real authorization request. Live screen evidence: `output/pdf/daily-request-live.png`.

No deployment performed. DEV schema updated and local server rebuilt/restarted only.
