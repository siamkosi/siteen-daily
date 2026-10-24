# Company member removal implementation plan

Execute inline on `codex/company-member-removal`, base `22a3b3c`. User scope is explicit; no further design questions, push or deploy.

1. RED/GREEN database tests: preview/remove RPCs, Owner/foreign/member/anonymous denial, stale assignment and membership incarnation, no document/photo/history/Auth deletion, other companies retained, pending/accepted invite handling and audit.
2. RED/GREEN UI tests: Owner confirmation, cancel/no write, protected Owner rows, stale/error recovery and successful list/audit refresh. Add the existing RPC confirmation flow to company-members.
3. Add real PostgreSQL concurrency regression for removal vs assignment and stale removal after rejoin. Run build, typecheck, lint, browser, SQL and API/model regressions.
4. Fresh read-only whole-change review required by executing-plans; fix material findings with RED/GREEN coverage. Commit locally and document rollout requirements. Keep production unchanged.

Security refinement during tests: reproduce the remove/rejoin assignment ABA, then bind role changes to membership UUIDs. Update existing fixtures to the new six-argument RPC and keep a legacy five-argument denial test. Record rollout requiring app refresh and coordinated migration/UI update.
