# Hampton account verification — 24 October 2026

Verified the user's Chrome session after their own password reset: `welovecyclist@gmail.com`, workspace `27 วิศวกรรม`, owner role, Supabase connected.

- Dashboard shows one active project, Hampton by Hilton Sukhumvit 11, Sukhumvit 11, with three submitted reports dated 22, 23 and 24 October 2026.
- Latest report `5eff862e-bd86-4281-9141-cf03742119fe`: HTH-27EN-ACE-DRP-043-2569, 24 October, one page, no attached photos, workforce/man-hours 0/0, one progress row `ไม่ได้ทำงาน`, notes `หยุดงาน`, steel plates 80.
- Opened edit form successfully; original number, progress, notes and totals loaded. Entered a temporary suffix in notes and canceled; did not save or change submitted status.
- Clicked the real PDF button: returned to ready state without app error, but Chrome's automation download event timed out. No successful browser download can be claimed. Browser policy blocked access to the internal downloads page; no bypass attempted.
- For a reviewable deliverable, copied only the currently authorized visible `.print-report` DOM, its observed local styles and three local logo assets into the same `/api/reports/pdf` service used by the button. Response PDF saved to `output/pdf/HTH-27EN-ACE-DRP-043-2569_2026-10-24.pdf`.
- `pdfinfo` confirms 1 A4 page. Rendered and visually inspected the whole page: Thai text, three logos, date/number, selected day shift, totals, progress, note, steel plates and signatures present; no blank photo page, clipping, browser URL or browser headers/footers.

Evidence: `output/pdf/hampton-edit-verified.png`, `output/pdf/hampton-latest-1.png`. No application code changes in this verification. No report writes, hosted configuration, schema/RLS, permissions, billing or deployment changes.
