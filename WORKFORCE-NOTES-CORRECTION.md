# Workforce totals, project name, notes and weather-box correction

Changed the requested DEV project name to Hampton by Hilton Sukhumvit 11. Operational staff remain in the staffing table with their group subtotal, but workforce totals include only daily and subcontract rows. Hampton totals are now 39 people / 312 man-hours (daily 15/120 + subcontract 24/192), while staff subtotal remains 14/112.

Added workforceTotal/workforceHours helpers while preserving generic all-row laborTotal/manHours for group subtotals and validation. Form, saved workers, dashboard values, editor summary and PDF now agree. Versioned DEV migration 20261023154409_exclude_staff_workforce replaces only the validation-preserving security-invoker derivation trigger and backfills structured reports with differing computed totals. Unstructured legacy totals remain intact. No grants or RLS policies changed. Local and hosted migration versions match.

Removed the duplicate work_done notes block. Notes now use only meta.notes, always show the หมายเหตุ: heading, and display a dash if empty. Original work_done text remains stored and editable. Structured progress continues to print in its table.

Weather selection was the existing overall day field แดดออก. It remains independent of hourly weather. Label now states สภาพอากาศ (ภาพรวม), and the checkmark is inside the corresponding colored square rather than a second adjacent checkbox. Existing hourly sectors remain unchanged.

Validation passed: build, lint, report-model tests, 40 PostgreSQL/RLS assertions and 2 browser tests. Security Advisors after DEV migration: no lints. Long-note pagination 7 expected/actual pages and seven-photo case 3 expected/actual pages, with valid margins. Final actual PDF: 2 A4 pages, new name on both, 39/312 totals, staff/daily/subcontract subtotals correct, separate notes, no duplicate work text, date/title/submitted status preserved, identical logo/photo image digests on both pages compared with prior PDF, no browser header/footer. Both pages visually checked. No deployment or production credentials.


## Latest owner/weather update

Hampton report owner text is now RSV Asset, saved through the signed-in editor and verified after reload. Removed weather checkmark and selected/unselected accessibility labels; the printed section is now a color legend plus the unchanged hourly clock. Existing overall weather data is retained for compatibility. The supplied logo set was not changed by this text edit.

Final export HTH-27EN-ACE-DRP-041-2569_22.10.2026_RSV.pdf passed both-page checks: RSV owner, no weather tick, unchanged 39/312 workforce totals, existing name/date/notes, identical logo/photo digests, four rain sectors and clean margins. Two A4 pages visually checked. Build/lint and 2 browser tests passed. No deployment.
