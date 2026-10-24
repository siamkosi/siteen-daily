# Hampton Hotel reference quantities — verified

Report a3639860-bb82-41a8-8a8b-63817e78c44d, DEV only. Added the user-authorized quantities from the supplied PDF via the signed-in editor. Preserved 13 staff rows, existing machines, progress, 22 October 2569 date, reporter title and all six original photos.

Added 8 daily rows: admin assistant 0, maintenance 0, crane driver 0, driver 3, checker 0, store assistant 1, office cleaner 0, daily labor 11. Total 15 / 120 man-hours.
Added 8 subcontract rows: rebar 2, piling 3, pile cutting 0, structural zone 1 10, structural zone 2 9, post-tension 0, slip form 0, coupler 0. Total 24 / 192 man-hours.
Existing staff 14 / 112 man-hours. Overall 53 / 424, independently verified from DEV after save/reload.

Tools: welding machine 2, Airman 0, drill 4, circular saw 2, grinder 5, steel plates 80, bending/cutting machine 4. Entered as quantities per the user's request. Enabled explicit count-only mode (meta.tools_count_only=true), so tool operating hours are unspecified and print as dashes, not fabricated hours. Existing numeric tool-hour defaults are ignored while this mode is enabled; equipment hour inputs are disabled and the PDF shows dashes. No database schema/policy changes.

Compact table style activates for long tables and retains all rows on the first page for this reference report. Build/lint passed, two browser tests passed including count-only mode and save/reload. Seven-photo and long-table stress cases retain 3/8 expected pages with valid text bounds.

Final PDF: HTH-27EN-ACE-DRP-041-2569_22.10.2026_full-reference-data.pdf. Two A4 pages; all 23 added labels and both group subtotals verified; 6 image digests exactly match the previous original photos; date/title correct; no Chrome header/footer; both pages rendered and visually inspected. Draft remains draft. No deployment or production credentials.
