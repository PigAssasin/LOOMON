create or replace function public.server_set_product_availability(
  actor_user_id uuid,
  target_product_id bigint,
  target_status text,
  reason text,
  expected_available_at timestamptz,
  expected_version integer,
  request_key uuid,
  source text default 'seller'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if actor_user_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  return public.set_product_availability(
    target_product_id,
    target_status,
    reason,
    expected_available_at,
    expected_version,
    request_key,
    source
  );
end;
$$;

create or replace function public.server_archive_product(
  actor_user_id uuid,
  target_product_id bigint,
  reason text,
  request_key uuid,
  source text default 'seller'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if actor_user_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  return public.archive_product(target_product_id, reason, request_key, source);
end;
$$;

create or replace function public.server_restore_archived_product(
  actor_user_id uuid,
  target_product_id bigint,
  request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if actor_user_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  return public.restore_archived_product(target_product_id, request_key);
end;
$$;

create or replace function public.server_delete_product_draft(
  actor_user_id uuid,
  target_product_id bigint,
  confirmation_slug text,
  request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if actor_user_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  return public.delete_product_draft(
    target_product_id,
    confirmation_slug,
    request_key
  );
end;
$$;

create or replace function public.server_adjust_variant_inventory(
  actor_user_id uuid,
  target_variant_id bigint,
  movement_type text,
  quantity integer,
  reason text,
  expected_version integer,
  request_key uuid,
  target_order_id uuid default null,
  source text default 'seller'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if actor_user_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  return public.adjust_variant_inventory(
    target_variant_id,
    movement_type,
    quantity,
    reason,
    expected_version,
    request_key,
    target_order_id,
    source
  );
end;
$$;

revoke all on function public.server_set_product_availability(
  uuid, bigint, text, text, timestamptz, integer, uuid, text
) from public, anon, authenticated;
revoke all on function public.server_archive_product(
  uuid, bigint, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.server_restore_archived_product(
  uuid, bigint, uuid
) from public, anon, authenticated;
revoke all on function public.server_delete_product_draft(
  uuid, bigint, text, uuid
) from public, anon, authenticated;
revoke all on function public.server_adjust_variant_inventory(
  uuid, bigint, text, integer, text, integer, uuid, uuid, text
) from public, anon, authenticated;

grant execute on function public.server_set_product_availability(
  uuid, bigint, text, text, timestamptz, integer, uuid, text
) to service_role;
grant execute on function public.server_archive_product(
  uuid, bigint, text, uuid, text
) to service_role;
grant execute on function public.server_restore_archived_product(
  uuid, bigint, uuid
) to service_role;
grant execute on function public.server_delete_product_draft(
  uuid, bigint, text, uuid
) to service_role;
grant execute on function public.server_adjust_variant_inventory(
  uuid, bigint, text, integer, text, integer, uuid, uuid, text
) to service_role;

