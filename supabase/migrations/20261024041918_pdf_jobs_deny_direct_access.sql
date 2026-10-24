-- No direct client access; only the guarded private functions manage leases.
create policy pdf_export_jobs_no_direct_access on private.pdf_export_jobs
for all to authenticated using (false) with check (false);
