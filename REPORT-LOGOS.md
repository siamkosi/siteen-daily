# Hampton report logos

Copied the three original user-supplied JPEG assets unchanged into public/report-logos. Order: APOLLO ASSET, AMPERSAND ACE, 27 ENGINEERING. Header uses object-fit:contain to preserve proportions and repeats on every report sheet. Report editor opt-in stores meta.logo_set=hampton; other reports retain SITE DAILY TH branding. No schema or RLS changes.

Enabled the set on report a3639860-bb82-41a8-8a8b-63817e78c44d. Preserved the user-existing submitted status, date 22 October 2569, 53 people / 424 man-hours, all entered rows, count-only tool mode, hourly weather and 6 photos. The report was briefly saved as draft during editing and then restored to its pre-edit submitted status before export.

Build/lint and 2 browser workflow tests passed, including logo persistence and six logo instances across both sheets. Final A4 PDF has 2 pages: page 1 contains 3 logos, page 2 contains the same 3 logos plus the original 6 photos. Decoded image digests confirm photos unchanged and logos identical on both pages. Weather sectors, Thai text, totals, date/title, margins and lack of browser header/footer verified. Both pages visually reviewed. PDF is self-contained; local relative logo URLs are embedded as JPEG data during rendering. No deployment.
