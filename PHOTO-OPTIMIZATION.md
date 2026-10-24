# Site photo preparation and pagination — DEV, 24 October 2026

Implemented on localhost and SITE DAILY TH DEV. No deployment. Existing Hampton images were not replaced, recompressed, or deleted.

## New uploads

- JPG, PNG and WebP inputs up to 20 MiB and 40 million decoded pixels. Corrupt/unsupported/empty files are rejected before storage writes.
- The browser decodes EXIF orientation and prepares one file at a time. The print image is JPEG quality 0.90, longest side up to 2,560 px; no upscaling. A 0.86 fallback is used only if the result would exceed the existing 5 MiB Storage object limit. An image still over that limit is rejected.
- A separate JPEG preview has longest side up to 640 px at quality 0.78. Transparent backgrounds are flattened to white; canvas output omits original EXIF metadata.
- Store the optimized print image and preview, not the raw original. The upload form tells users this; original files on their devices remain untouched.
- Both objects use private `site-photos` Storage with the same workspace/project/report UUID prefix. The print image uses `<photo-id>.jpeg`, preview uses `<photo-id>.thumb.jpeg`. Metadata records paths, dimensions and byte sizes.
- Insert the photo row only after both uploads succeed. A failed second upload or metadata insert cleans up the successfully uploaded variants. Cleanup failure is reported explicitly. Partial multi-file batches report how many images succeeded and refresh report photos even when a later file fails.
- Existing photo removal handles both variants. Existing lifecycle protections apply equally to previews: no writes/deletions for trash or cancelled reports, no viewer writes or cross-company access.

## Reading photos

- Dashboard/workspace loading no longer selects company-wide photo metadata or generates company-wide photo signed URLs.
- Gallery filters by project and inclusive **Daily Report date** bounds. A server query reads at most 25 rows: show 24 and use the extra row only to enable Next. Batch-sign only the visible previews, with the existing 1-hour validity. Stable order: `created_at desc, id desc`.
- Filter changes reset to page 1 and abort the previous read; stale responses cannot display another filter/company's results. Invalid date ranges do not issue a gallery query. Empty/error/retry/loading states and mobile pagination are included.
- Gallery excludes trashed and cancelled reports. Legacy images with no preview use their existing image path without backfilling or modifying historical files.
- Report detail fetches only the selected report's photos, in ordered batches of 100, and signs its print and preview paths. Loading/errors disable PDF export so a failed photo request cannot silently produce a PDF missing attachments.
- Editing thumbnails use previews. The printed report uses the print image URL. PDF cloning forces eager image loading and embeds the print image, not the preview. Existing 32 MiB PDF request limits still apply to the whole encoded document.

## Automatic signed-link renewal — local update, 24 October 2026

- Signed links remain valid for 3,600 seconds. Report attachments, the visible gallery page and private project covers renew at 55 minutes while visible. Returning to a tab, waking the computer or reconnecting rechecks overdue links; no whole-document reload or save is triggered.
- Renewal preserves the mounted report editor, unsaved fields, gallery project/date filters and page number. Requests from a previous page/company are aborted or ignored after cleanup. The gallery still signs at most the 24 visible previews; it does not load the company's full image library.
- If an upload/delete completes during a pending renewal, its manual refresh is queued and runs immediately after that read. The older snapshot cannot hide the newly added photo or leave a deleted attachment displayed until the next renewal.
- Failed authorization/renewal removes stale URLs instead of retaining them indefinitely. Report/gallery show an error and retry control; covers fall back to their illustration. Automatic retries back off from 30 seconds to five minutes and retry on reconnection. Image-load errors allow one additional renewal per successful timer/manual cycle, avoiding a request loop for a broken image.
- PDF export signs the attachment **print paths** again immediately before fetching/embedding. This also covers suspended tabs and a click before background renewal commits. It never substitutes previews. Signing/fetch failure stops export rather than generating a PDF missing attachments. Existing API authentication, RLS and PDF limits stay in place.
- No migration, bucket permissions, upload format or historical file changes. No deploy or hosted data writes in this update.

### Renewal verification

- Final full browser run: **64/64 passed**, no skips/flaky results, using isolated synthetic accounts and mocked Supabase responses. Six new cases cover 55-minute renewal; resuming after an hour with filters/page retained; an unchanged unsaved editor and refreshed covers; bounded image-error retries and reconnect recovery; fresh full-size PDF embedding with signing failures blocking export; stale responses after changing project; and queued refresh after a concurrent deletion (some cases exercise multiple conditions).
- Time expiry is simulated with the browser clock/visibility events, not an hour-long physical-device session. PDF export's fresh image URLs are fetched once and embedded as data URLs. Existing image-size/quality and actual renderer regressions also pass.
- SDK version-write contract: 3/3 passed. Embedded PostgreSQL/RLS: 295 assertions passed. Production build including TypeScript, lint, formatting and report-model checks passed.
- The first full run had a recovery-test navigation race: both Login and recovery have an email field. The test now waits for the recovery heading before filling. Auth application code was not changed; the final full run passes.
- Evidence: `output/readiness/signed-image-browser-final.json`, `signed-image-build.log`, `live-document-contract.log`, and `signed-image-verification.json`. Hosted live-integration writes and Hostinger deployment were not performed.

## Database

DEV migration: `20261024050954_photo_thumbnails_and_paging.sql` (aligned with hosted migration history). Adds nullable legacy-compatible photo variant metadata with path/range constraints, workspace/project pagination indexes, and thumbnail path support in the existing lifecycle-aware Storage predicate. No public bucket, new role, service key, paid transformation service, or background worker is introduced.

## Original optimization verification

- Build/TypeScript, lint, report-model checks, full browser regression suite, and 217 embedded PostgreSQL/RLS assertions.
- Browser tests: resize/reduction, separate preview use, EXIF rotation, small-image non-upscaling, corrupt-file rejection, PDF embedding print-resolution images, bounded server pagination, inclusive report dates/project filtering, page reset, legacy fallback, mobile overflow, photo-read retry and disabled PDF during errors, and rollback of one/both objects after failed uploads.
- A synthetic 4,000 × 3,000 JPEG (2,332,855 bytes) produced a 2,560 × 1,920 print image (1,708,917 bytes) and 640 × 480 preview (107,331 bytes). Reduction varies by image; no fixed compression ratio is promised.
- The exported two-page QA PDF contains 2,560 × 1,920 and EXIF-corrected 800 × 1,200 images, with no 640 × 480 preview embedded. Compared with a resized reference, the synthetic print-image PSNR measured 32.67 dB; the rendered attachment page was visually checked for readable labels and line detail.
- Hosted DEV schema and security advisors checked; existing Hampton gallery and date filtering verified through Chrome without uploading test files to Hampton.

Storage backup, retention purging, upload resumption, and usage quotas are separate follow-up work. This change does not enable those features.

Original optimization result: all 34 browser tests passed in one full run (3.1 minutes); 217 RLS assertions passed; build/TypeScript, lint and report-model checks passed. In Chrome, Hampton's 22 October 2026 filter returned all 6 original images; a later report-date range returned none. No Hampton image uploads or document mutations were performed.
