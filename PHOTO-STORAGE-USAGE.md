# Company photo storage usage — DEV, 24 October 2026

Added `/storage` (**พื้นที่จัดเก็บรูป**) and in-app capacity warnings. Local app and isolated Supabase DEV only; no deployment, package purchase, account/role changes or photo/document mutation.

## Scope and counting

- Members can read a company aggregate. Only the company's Owner can set/change its notification quota.
- Count `site-photos` and `project-covers` objects whose path starts with the requested workspace UUID. Aggregate on the server without downloading images, signing their URLs, or returning object names/metadata to the browser.
- Prefer Storage object `metadata.size`. For missing/invalid size metadata, use the stored print/thumbnail byte size when available. This covers legacy photos that predate byte-size columns.
- Include completed projects, trash, cancelled reports, previews, current project covers and unlinked/stale files. Trash/cancelled bytes are subsets of total bytes, not extra amounts to add again.
- File categories are print/report images, previews, current project covers and other files. Unknown project folders have an explicit unassigned row. Zero-use projects remain listed.
- Unknown sizes are counted and disclosed; the known total is a lower bound. Fetch failures or wrong-workspace responses never appear as zero usage.
- Totals cover file bytes only. They exclude database, provider bandwidth/egress, downloaded PDFs, unrelated buckets and the provider's organization-wide plan allowance.

## Quota and warnings

The user explicitly chose to let the Owner configure quota later. DEV quota is left unset. No assumed Supabase plan limit is stored.

- Owner enters an optional company quota in decimal GB (1 GB = 1,000,000,000 bytes); blank disables the app notification quota. Valid range: 1 MB to 1 PB.
- Warn in the app at 80%, escalate at 95%, and show quota reached at 100% or above. Remaining bytes clamp to zero on overage.
- Warning banners appear across company screens, with a link to the project breakdown. They are excluded from printing and PDF documents. No email/OS notification or scheduled external task is created.
- This quota is a planning/notification budget. It does not buy/extend the provider plan and does not block uploads.
- Refresh on workspace/page initialization, successful project/cover changes, photo upload completion/failure/cleanup, photo removal, lifecycle changes and quota changes. A visible open page also refreshes after five minutes and on focus if its check is older than five minutes. There is a manual refresh button.
- Owner quota writes use the previous value as an optimistic concurrency check, including an explicit expected null. Unsaved drafts survive a refresh; concurrent edits are rejected until the Owner loads the latest value.

## Security and migrations

`20261024061439_company_photo_storage_usage.sql` adds private quota settings and company-scoped RPCs. Private definer functions are required to aggregate retained objects that normal per-document trash RLS hides; they check `auth.uid()` and company membership before reading any usage. Only project names/IDs, counts, byte totals, thresholds and the current company quota are returned. The setter locks and verifies the caller's company ownership before updating its private row.

`20261024061808_company_photo_quotas_deny_direct_access.sql` makes the private table's intentional denial explicit with a restrictive false RLS policy. No direct table grants are added. Exposed RPC wrappers are security invokers; anonymous execution is revoked, and definer functions use an empty search path. Storage tables are read only throughout this feature. Local versions match hosted DEV migration history.

## Verification

- Build/TypeScript, lint, report-model checks and all 40 browser tests passed. Embedded PostgreSQL/RLS suite passed 263 assertions, including legacy metadata sizes, print/preview/cover/other totals, zero/unassigned projects, retained bytes, unknown sizes, actual-metadata precedence/fallback, private table denial, owner-only mutation, cross-company/anonymous denial, invalid quotas and stale writes.
- UI tests cover all three roles, unset/80%/95%/100%/over-quota states, global warning links, quota reset, concurrent edits starting from null, mobile layout, wrong-company response rejection, explicit failures/unknown sizes, no photo downloads for summary, and refreshing usage after upload.
- Supabase security advisors returned no findings after the explicit denial policy.
- Chrome confirmed company 27 วิศวกรรม / Hampton usage: 1,716,468 bytes of existing site photos plus 97,516 bytes of project cover = 1,813,984 bytes (1.81 MB), 6 site photos, 7 stored objects. Existing files were unchanged. The signed-in Editor can read usage and cannot edit quota. The quota remains unset as requested.
