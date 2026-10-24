# DEV account verification — 24 October 2026

Signed-in UI verified `siamkosi@gmail.com`, owner of บริษัททดสอบ SITE DAILY TH — ข้อมูลสมมติ, connected to Supabase (not demo mode).

## Preserved records

- 2 active projects: DEV ตัวอย่างฟอร์ม DRP ตามเอกสารอ้างอิง; DEV ทดสอบรายงาน 1 วัน — บ้านพักอาศัย 2 ชั้น.
- 2 submitted reports, both dated 23 October 2026, IDs `bb91a19e-a0f0-4255-8c9a-3310e33a27b7` and `6b0a0d40-37fa-4b3f-9e24-39b00f76e777`. They match the retained sample IDs in DEV-CONNECTION.md.
- Structured report: workforce 12, 96 man-hours, one attached illustration. Legacy report: workforce 14, one attached illustration. Both open in edit mode with existing values. A temporary note in the legacy editor was canceled; no report save or status change was performed.
- Both reports downloaded through their real UI PDF buttons. Files copied to `output/pdf/`. Each is 2 A4 pages; all four pages rendered and visually inspected: Thai text, tables, illustration, signatures and margins present, no browser headers/footers.

## PDF defect fixed

The legacy record had no `report_details.meta`. Export filename access threw before requesting a PDF. Added optional chaining for `meta`; no database migration or data update. After rebuilding/restarting the local server and reloading the browser, the real legacy report downloaded successfully. Added a browser regression test using empty legacy details.

## Hampton — separately authorized read-only check

An initial overly broad SQL request was rejected by automatic approval review; it was not executed. The user then explicitly authorized reading only the two documented Hampton report IDs and the workspace owner's email. Those scoped reads succeeded:

- Owner: `welovecyclist@gmail.com`; workspace: 27 วิศวกรรม; project: Hampton by Hilton Sukhumvit 11.
- 24 October report `5eff862e-bd86-4281-9141-cf03742119fe`, number HTH-27EN-ACE-DRP-043-2569, submitted, workforce 0, 0 photos.
- 22 October report `a3639860-bb82-41a8-8a8b-63817e78c44d`, number HTH-27EN-ACE-DRP-041-2569, submitted, workforce 39, 6 photo records.

Hampton is absent from the current account because it belongs to the other workspace/account. No membership or permission change. Hampton edit/PDF through its owner's UI remains unverified in this run and requires that account's normal login.

Lint/build passed. Existing recovery/auth/full workflow browser tests passed after the fix (3 tests). The legacy regression passed separately (1 test). Regression fixture initially used an incorrect `next_plan` field; corrected to the actual `tomorrow` field. The error assertion targets the app error alert rather than Next.js's empty route announcer.

No deployment, hosted data write, schema/RLS/Auth configuration or billing changes.
