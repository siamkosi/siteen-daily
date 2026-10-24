# Company member management — 24 October 2026

Owner can open **บริษัทและการตั้งค่า → จัดการสมาชิก** for the selected company, including 27 วิศวกรรม, and see member emails/roles. Each non-owner row offers editor → viewer or viewer → editor, followed by an explicit confirmation showing email, company, old/new role and effect. Cancel sends no mutation. Owner rows are immutable. No account creation, invitations, additions or removals.

Role changes cover every project/report/photo in that company. Existing RLS enforces new access on subsequent data requests; users with an open tab should reload to refresh visible controls. Existing content already loaded in a browser is not erased retroactively.

## Authorization

- `list_company_members` and `set_company_member_role` are SECURITY INVOKER public wrappers over narrowly scoped private SECURITY DEFINER helpers with empty search_path and fully qualified tables.
- Both helpers check the caller's actual owner membership using auth.uid(). Email roster is limited to that workspace. Caller identity is never accepted as a parameter.
- Role mutations lock the caller's owner membership during the operation; allow only existing editor/viewer rows, require expected old role to prevent stale changes, and refuse self/owner mutation or owner promotion. There are no direct membership write grants; existing membership SELECT RLS remains unchanged.
- No service-role key in the app. Anonymous callers and cross-company/non-owner calls are rejected by the database.

## DEV and validation

- Applied `20261024012743_owner_member_management.sql` only to SITE DAILY TH DEV `hvcwskmqwvrjsrysllly`. Local filename reconciled with recorded hosted migration version. Do not apply twice.
- Local PostgreSQL/RLS: 72 assertions passed, including owner isolation, invalid/null roles, stale role, missing member, anonymous access, editor/viewer denial, and downgrade/restore write permissions.
- Browser tests: 3/3 passed using mocked Auth/Data API, exercising owner cancel/confirm in both directions, owner-only rendering and desktop/mobile layout without page overflow. Screenshot QA reviewed at desktop and 390px mobile width. No real users or memberships created by those tests.
- Build (including TypeScript) and targeted ESLint passed.
- Hosted DEV RPC tested as existing owner inside a transaction: list members, siamkosi editor → viewer, verify no write access, restore editor, then ROLLBACK. No membership changes persisted by verification. Security Advisors: lints [].
- Live owner browser session was signed out during final verification, so the new screen was not interacted with as the real owner. It is ready at /settings after normal owner sign-in. Browser UI tests used mock data; hosted RPC validation used the existing identities under authenticated database role.
- Existing actual members remain welovecyclist@gmail.com = owner and siamkosi@gmail.com = editor. No new accounts added. No web deployment.

## Subsequent owner transfer — 24 October 2026

At the user's explicit request, swapped these two roles only in 27 วิศวกรรม in one transaction, with identity/current-role checks and row locks. Readback confirmed **siamkosi@gmail.com = owner**, **welovecyclist@gmail.com = editor**. This supersedes the role snapshot above. No report/project data or other company memberships changed. The existing UI deliberately cannot transfer ownership; the authorized transfer was performed administratively. The in-app browser session was signed out during follow-up, so the owner screen requires normal sign-in again. No deployment.
