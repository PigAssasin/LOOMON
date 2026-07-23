create or replace function public.claim_product_media_cleanup_jobs(
  worker_id text,
  batch_size integer default 25
)
returns table (
  job_id bigint,
  media_asset_id bigint,
  storage_bucket text,
  storage_path text,
  attempt integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(worker_id), '') is null then raise exception 'WORKER_ID_REQUIRED'; end if;

  return query
  with claimed as (
    select job.id
    from internal.storage_cleanup_jobs job
    where job.status in ('pending', 'failed')
      and job.next_attempt_at <= now()
      and job.attempts < 10
    order by job.next_attempt_at, job.id
    for update skip locked
    limit least(greatest(batch_size, 1), 100)
  )
  update internal.storage_cleanup_jobs job
  set
    status = 'processing',
    attempts = attempts + 1,
    last_error = null
  from claimed
  where job.id = claimed.id
  returning
    job.id,
    job.media_asset_id,
    job.storage_bucket,
    job.storage_path,
    job.attempts;
end;
$$;

create or replace function public.complete_product_media_cleanup_job(
  target_job_id bigint,
  succeeded boolean,
  error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job internal.storage_cleanup_jobs%rowtype;
begin
  select * into job
  from internal.storage_cleanup_jobs
  where id = target_job_id
  for update;

  if not found then raise exception 'CLEANUP_JOB_NOT_FOUND'; end if;
  if job.status = 'completed' then return; end if;
  if job.status <> 'processing' then raise exception 'CLEANUP_JOB_NOT_CLAIMED'; end if;

  if succeeded then
    delete from catalog.media_assets
    where id = job.media_asset_id
      and not exists (
        select 1
        from catalog.product_media pm
        where pm.media_asset_id = job.media_asset_id
      );

    update internal.storage_cleanup_jobs
    set
      status = 'completed',
      completed_at = now(),
      last_error = null
    where id = target_job_id;
  else
    update internal.storage_cleanup_jobs
    set
      status = 'failed',
      next_attempt_at = now() + make_interval(
        secs => least(3600, 30 * (2 ^ least(attempts, 7))::integer)
      ),
      last_error = left(coalesce(error_message, 'unknown cleanup error'), 2000)
    where id = target_job_id;
  end if;
end;
$$;

revoke all on function public.claim_product_media_cleanup_jobs(text, integer)
  from public, anon, authenticated;
revoke all on function public.complete_product_media_cleanup_job(bigint, boolean, text)
  from public, anon, authenticated;

grant execute on function public.claim_product_media_cleanup_jobs(text, integer)
  to service_role;
grant execute on function public.complete_product_media_cleanup_job(bigint, boolean, text)
  to service_role;
