# DEV password recovery — 24 October 2026

Added local `/reset-password` and `/update-password` routes with Supabase email recovery and user-entered password confirmation. Login now links to recovery. Callback uses `http://127.0.0.1:3000/update-password`; keep the local server running while following the email link. Supabase checks the recovery token/session and enforces password policy; no admin password change or security bypass is used.

Lint and production build passed. Browser recovery test passed with mocked email request, correct callback and disabled password update without a session. No real password was entered by the assistant.

One real recovery request for the user-authorized DEV account was submitted through the local UI; the app displayed its accepted-request message. This does not independently confirm inbox delivery. The user must open their email link and enter/confirm the new password themselves. No recovery token or password was read or saved in project files.

Local server at port 3000 was restarted to serve the new routes. No deployment, hosted schema, RLS, billing or Auth configuration changes.

Pending after user completes recovery: sign in, compare projects and latest reports with `DEV-CONNECTION.md` / `DIRECT-PDF-EXPORT.md`, open edit form, download and inspect PDF. These checks have not yet been completed with the real account in this run.
