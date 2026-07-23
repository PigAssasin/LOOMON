drop policy if exists product_command_receipts_deny_client
on internal.product_command_receipts;
create policy product_command_receipts_deny_client
on internal.product_command_receipts
for all to authenticated
using (false)
with check (false);

drop policy if exists storage_cleanup_jobs_deny_client
on internal.storage_cleanup_jobs;
create policy storage_cleanup_jobs_deny_client
on internal.storage_cleanup_jobs
for all to authenticated
using (false)
with check (false);

revoke execute on function public.set_product_availability(
  bigint, text, text, timestamptz, integer, uuid, text
) from authenticated;
revoke execute on function public.archive_product(bigint, text, uuid, text)
  from authenticated;
revoke execute on function public.restore_archived_product(bigint, uuid)
  from authenticated;
revoke execute on function public.delete_product_draft(bigint, text, uuid)
  from authenticated;
revoke execute on function public.adjust_variant_inventory(
  bigint, text, integer, text, integer, uuid, uuid, text
) from authenticated;

grant execute on function public.set_product_availability(
  bigint, text, text, timestamptz, integer, uuid, text
) to service_role;
grant execute on function public.archive_product(bigint, text, uuid, text)
  to service_role;
grant execute on function public.restore_archived_product(bigint, uuid)
  to service_role;
grant execute on function public.delete_product_draft(bigint, text, uuid)
  to service_role;
grant execute on function public.adjust_variant_inventory(
  bigint, text, integer, text, integer, uuid, uuid, text
) to service_role;
