# Hampton shared membership — 24 October 2026

At the user's explicit request, added confirmed DEV user `siamkosi@gmail.com` to workspace `27 วิศวกรรม` (`dcf175be-9fe4-49cb-a4e5-f2fdf88a41d5`) as `editor`. Verified both user and workspace/project identities before insertion. `welovecyclist@gmail.com` remains `owner`.

The existing role model grants access at company level: editor can read/edit company projects and reports and manage attached photos. It includes Hampton and future projects of this company, not just one selected project. No role escalation to owner, schema, RLS policy or deployment change.

Verification:
- Membership query confirms editor and owner roles.
- In siamkosi's actual authenticated browser, the company selector now lists both the original test company and 27 วิศวกรรม.
- Selecting 27 วิศวกรรม loads Hampton and all three reports. Latest report 043 opens its populated edit form with save controls; canceled without saving.
- Database write permission tested with authenticated role plus siamkosi user identity, using a no-op update of the latest report inside a transaction followed by rollback. One row returned; no report changes committed.

Found a local UI issue exposed by having two companies: page navigation remounts SiteApp and selected the first company again. Updated company selection to persist in sessionStorage per authenticated user and revalidate it against current memberships on loading. Storage failure falls back safely to current/default authorized membership. No auth token stored by this change.

Validation: targeted ESLint passed; production build including TypeScript passed. After restarting the local server, siamkosi selected 27 วิศวกรรม, navigated report → dashboard → report, and opened the latest edit form with the selected company retained. Canceled without report writes and left the Hampton report open. Evidence: `output/pdf/siamkosi-hampton-editor.png`. Full-project lint was stopped after hanging; targeted lint completed successfully. No deployment.
