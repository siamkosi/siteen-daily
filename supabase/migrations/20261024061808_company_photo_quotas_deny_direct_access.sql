-- Quota settings are reachable only through company-scoped, owner-checked RPCs.
-- An explicit deny policy documents that RLS with no direct grants is intentional.
create policy company_photo_quotas_deny_direct_access
on private.company_photo_quotas as restrictive for all to authenticated
using (false) with check (false);
