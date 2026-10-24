# Document lifecycle — DEV, 24 October 2026

Implemented on local SiteEN DAILY and SITE DAILY TH DEV (`hvcwskmqwvrjsrysllly`). No application deployment. Existing Hampton documents are unchanged.

| Role | Draft to trash | Restore within 30 days | Cancel submitted document |
|---|---|---|---|
| Owner | Any company draft | Any company draft | Yes, reason required |
| Editor | Own drafts only | Ask Owner | No |
| Viewer | No | No | No |

- Trash is under **ถังขยะเอกสาร**. Recoverable for exactly 30 × 24 hours from the database timestamp, with expiry displayed in Bangkok time. Expired drafts stay retained but cannot be restored through the app; there is no automatic permanent purge or permanent-delete button.
- Trash is excluded from dashboards, ordinary lists, templates, galleries and PDF export. Owner and the editor who created a draft can read that draft in trash. Photos remain attached and cannot be added, deleted or replaced while trashed.
- Restoring preserves the draft ID and attachments. An active document for the same project/date blocks restoration; first resolve that document. Partial unique indexes make this safe under concurrent requests. Cancelled/trashed documents do not occupy the active project/date slot.
- Submitted documents cannot be turned back into drafts. Existing submitted-document editing is still available and audited; cancellation freezes the document and attachments. Cancellation requires a company Owner and a nonblank reason (max 1,000 characters).
- Cancelled documents remain in the normal document lists marked **ยกเลิกแล้ว**, and are excluded from active dashboard counts and templates. They remain readable; new PDF copies have a cancellation watermark on every page.
- Lifecycle actions are tenant-scoped optimistic RPC updates. Triggers also enforce permission, author, allowed transitions, server clock and actor for direct Data API calls. No DELETE grants exist for reports, requests or event history.
- `document_events` is append-only for authenticated clients. Private triggers capture before/after document snapshots, actor ID, server timestamp, reason and attached-photo metadata. History starts when this migration is enabled; it cannot reconstruct edits made earlier.
- The **ประวัติเอกสาร** panel loads history on demand with pagination. Original document data stays available in cancellation snapshots and the frozen document. Exported PDFs and externally signed files are not uploaded/archived automatically; an already downloaded or signed external PDF is not modified or recalled.

## PDF title correction

The renderer used a blank browser page with no HTML title, so Chromium put `about:blank` in PDF document metadata. The download filename was already supplied separately. The renderer now sets a safely escaped title: document kind + document number/date filename + SiteEN DAILY. This fixes newly exported files; existing PDFs need to be exported again.

The PDF API checks document access and excludes trash. Cancellation state is read using the caller JWT/RLS and overwrites any cancellation flag supplied in the request, so the normal export path cannot suppress it through request JSON.

## Validation

- PostgreSQL/RLS coverage in `tests/rls.mjs` exercises both tables: ownership, viewers/outsiders, direct API bypasses, immutable cancellation, append-only history, attachments, date conflicts, stale actions and exact 30-day expiry.
- Browser lifecycle tests cover trash → restore → cancel with reason → history → PDF download → reload for both document types, using isolated demo data.
- Existing full workflow, membership, project cover, PDF security and request-template regression suites are retained.

Final checks: build/TypeScript and lint passed; 203 PostgreSQL/RLS assertions passed; the existing browser regression scenarios passed, and both lifecycle flows passed after correcting a test locator that matched duplicate status labels. PDF metadata title is asserted for both generated files. Supabase security advisors returned no findings. Local migration version is aligned with the applied DEV migration: 20261024044310_document_lifecycle.sql.
