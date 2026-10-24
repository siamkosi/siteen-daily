# Project cover images and document buttons — 24 October 2026

Owners/editors can open **โครงการ → ตั้งค่ารูปโครงการ — <project>**, select a JPG/PNG/WebP up to 5 MB, preview it, and save. The image appears on project cards in both the dashboard and projects page. Cancel leaves existing data untouched. Removing the image restores the built-in illustration. Invalid types, empty/oversized files and unreadable images are rejected. The form scrolls into view when opened and supports mobile screens.

Images use the private `project-covers` Storage bucket and `projects.cover_path`; signed URLs are resolved at load time and never stored in database rows. Owner/editor writes and member reads use existing company membership rules. Storage paths require an existing project in the matching workspace. No object UPDATE/upsert or anonymous access is granted. Replacements upload to a new UUID path before updating the project; failed metadata saves remove the new upload and preserve the previous image. Old images are removed only after the replacement is saved.

DEV migration `20261024033552_project_covers.sql` is applied to `hvcwskmqwvrjsrysllly`; local filename matches hosted migration history. No existing Hampton image, report, request, membership or role was changed. The user chooses the real project photograph in the opened form.

The paired document links **เปิด Daily Request ของวันเดียวกัน** and **เปิด Daily Report ของวันเดียวกัน** both use the same secondary button style. The redundant **ไปที่ Daily Request** link is removed from the daily document checklist; the main navigation remains available.

Validation: production build/TypeScript and targeted ESLint; embedded PostgreSQL migration/RLS tests (106 assertions); existing report/request/member/default-company browser regressions; project image browser tests for demo persistence, invalid images, preview/cancel/removal, mobile layout, editor Storage upload/update failure rollback/retry and viewer signed reads without controls. Hosted DEV bucket settings, column, policies and Hampton owner access were verified; security advisors returned no lints.

No web deployment. The local server at port 3000 runs the updated build.
