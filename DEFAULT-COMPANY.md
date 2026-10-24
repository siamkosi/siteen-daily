# Default company — 24 October 2026

Configured the existing siamkosi account (`f0eed677-bb05-4863-9b9a-30164206b61f`) to start in 27 วิศวกรรม (`dcf175be-9fe4-49cb-a4e5-f2fdf88a41d5`) on each new login. `workspace-preference.ts` checks the verified Auth user's last_sign_in_at against a per-user sessionStorage login marker and resets the selected company for a new login. No email comparison or authorization based on user metadata.

Manual company switching remains available during the same login; navigation and reload retain the selection. A new tab starts with the configured default. The default is accepted only when returned in the user's current memberships; otherwise the first authorized company is used. Other accounts retain their existing selection behavior. No membership/role, data, Auth setting or schema changes.

Validation: targeted ESLint and build/TypeScript passed. Browser tests passed for login resetting the company despite a previously selected test company, manual switching across navigation/reload, missing membership fallback, and existing owner/editor/viewer member management (5 tests total). Tests mock Auth/Data API and do not sign out the real user or write DEV data. Local server restarted with updated build; no deployment.
