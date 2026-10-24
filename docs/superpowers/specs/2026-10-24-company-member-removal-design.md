# Remove a company member

The user requested an Owner-only removal button, explicit confirmation and retention of existing reports, photos and history. They previously authorized inline implementation/testing without more plan approvals. This change is local only: no push, hosted migration, real member changes, email or deployment.

Use the existing guarded Supabase RPC and company access audit pattern. Remove only the company membership and its cascading project assignments; keep the Auth account, other company memberships, projects, documents, document history and storage objects. Owners (including the acting Owner) cannot be removed.

On click, fetch an Owner-authorized preview containing company/member identity, membership incarnation UUID, all assignment revisions and the projects losing access. Confirmation shows the email/company, affected projects and retention effect. Cancellation makes no mutation. A membership incarnation and assignment fingerprint prevent stale confirmation after role changes or removal/rejoin. A changed snapshot requires reload and fresh confirmation.

Removal, pending invitations cancellation for that company/current email and append-only audit recording happen in one transaction under the same company lock used by invitation/assignment RPCs. Old accepted invitations cannot claim success when membership no longer exists. Rejoining requires a new Owner invitation and acceptance. Existing signed image links retain their documented expiry of up to one hour; new requests lose authorization immediately.

Alternatives considered: withdrawing each project leaves an unwanted company membership; deleting Auth would affect other companies and retained authorship. Company membership removal is the requested scope.

Validate with isolated PostgreSQL checksums/authorization tests, actual multi-connection races, desktop/mobile browser tests with mocked Auth/REST, and existing regression checks. No real account/session credentials or live data are used.

Role-change confirmations also bind the membership incarnation as well as assignment row_version. Otherwise a removal/rejoin resets assignment versions and an old role-change form could grant access to the new membership. Owner roster RPC `list_company_members_with_revisions` returns scalar JSON (not capped table rows); the six-argument assignment RPC accepts its membership UUID. The legacy five-argument mutation deliberately fails with 40001 and asks the Owner to reload.

Future rollout: apply `20261024160347_company_member_removal.sql` and ship this app together after backup and approval. Before the app update, old role-change forms safely fail and need refresh; removal is unavailable until the new UI is loaded. No data backfill beyond generated membership UUIDs or storage cleanup is needed. This change is not deployed by this task.

Final review refinement: the roster response nests each member's assignment rows from the same SQL SELECT snapshot. The UI must not combine two independent roster/assignment requests: across removal/rejoin, an old assignment version1 could otherwise be paired with a new membership UUID. Regression verifies old separate response is ignored and the single roster response drives both displayed role and confirmation.

Review scope and remaining minor: confirmation is rendered after the roster; a long roster may require scrolling to confirm. Automatic focus/scroll is deferred. Hosted migration/session/email delivery and real signed-link expiry are excluded from this local-only task. Out-of-band privileged SQL changes bypass the supported application protocol. Production-scale roster performance has no representative benchmark; a very large company may require pagination later.

Verified locally on 2026-10-24: production build, typecheck, lint, formatting and diff checks passed. Final isolated browser suite76/76 (including six removal/snapshot tests and existing PDF flows); embedded removal64/RLS291/project isolation87; actual multi-connection PostgreSQL22; invitation API6/SDK3 and report model checks passed. One final fresh review found a mixed-snapshot issue, reproduced RED and fixed; complete suite GREEN after that fix. No live membership/account/email/storage changes, hosted migration, push or deploy.
