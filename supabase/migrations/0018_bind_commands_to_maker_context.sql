drop function public.server_set_product_availability(
  uuid, bigint, text, text, timestamptz, integer, uuid, text
);
drop function public.server_archive_product(uuid, bigint, text, uuid, text);
drop function public.server_restore_archived_product(uuid, bigint, uuid);
drop function public.server_delete_product_draft(uuid, bigint, text, uuid);
drop function public.server_adjust_variant_inventory(
  uuid, bigint, text, integer, text, integer, uuid, uuid, text
);
drop function public.server_get_product_reference_impact(uuid, bigint);

create or replace function public.server_set_product_availability(
  actor_user_id uuid,
  expected_maker_id bigint,
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
  if not exists (
    select 1 from catalog.products
    where id = target_product_id and maker_id = expected_maker_id
  ) then raise exception 'TARGET_MAKER_MISMATCH'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  return public.set_product_availability(
    target_product_id, target_status, reason, expected_available_at,
    expected_version, request_key, source
  );
end;
$$;

create or replace function public.server_archive_product(
  actor_user_id uuid,
  expected_maker_id bigint,
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
  if not exists (
    select 1 from catalog.products
    where id = target_product_id and maker_id = expected_maker_id
  ) then raise exception 'TARGET_MAKER_MISMATCH'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  return public.archive_product(target_product_id, reason, request_key, source);
end;
$$;

create or replace function public.server_restore_archived_product(
  actor_user_id uuid,
  expected_maker_id bigint,
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
  if not exists (
    select 1 from catalog.products
    where id = target_product_id and maker_id = expected_maker_id
  ) then raise exception 'TARGET_MAKER_MISMATCH'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  return public.restore_archived_product(target_product_id, request_key);
end;
$$;

create or replace function public.server_delete_product_draft(
  actor_user_id uuid,
  expected_maker_id bigint,
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
  if not exists (
    select 1 from catalog.products
    where id = target_product_id and maker_id = expected_maker_id
  ) then raise exception 'TARGET_MAKER_MISMATCH'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  return public.delete_product_draft(
    target_product_id, confirmation_slug, request_key
  );
end;
$$;

create or replace function public.server_adjust_variant_inventory(
  actor_user_id uuid,
  expected_maker_id bigint,
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
  if not exists (
    select 1
    from catalog.product_variants variant
    join catalog.product_versions version
      on version.id = variant.product_version_id
    join catalog.products product on product.id = version.product_id
    where variant.id = target_variant_id
      and product.maker_id = expected_maker_id
  ) then raise exception 'TARGET_MAKER_MISMATCH'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  return public.adjust_variant_inventory(
    target_variant_id, movement_type, quantity, reason, expected_version,
    request_key, target_order_id, source
  );
end;
$$;

create or replace function public.server_get_product_reference_impact(
  actor_user_id uuid,
  expected_maker_id bigint,
  target_product_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  product_row catalog.products%rowtype;
  availability_row catalog.product_availability%rowtype;
  quote_count integer;
  customization_count integer;
  order_count integer;
begin
  if actor_user_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);

  select * into product_row
  from catalog.products
  where id = target_product_id and maker_id = expected_maker_id;
  if not found then raise exception 'TARGET_MAKER_MISMATCH'; end if;
  if not catalog.has_maker_role(
    product_row.maker_id,
    array['owner', 'manager', 'catalog_editor']
  ) then raise exception 'NOT_AUTHORIZED'; end if;

  select * into availability_row
  from catalog.product_availability
  where product_id = target_product_id;
  select count(distinct quote_request_id)::integer into quote_count
  from commerce.quote_request_items where product_id = target_product_id;
  select count(*)::integer into customization_count
  from customization.projects where selected_product_id = target_product_id;
  select count(distinct orders.id)::integer into order_count
  from commerce.orders orders
  join commerce.quote_versions quote_version
    on quote_version.id = orders.accepted_quote_version_id
  join commerce.quote_request_items quote_item
    on quote_item.quote_request_id = quote_version.quote_request_id
  where quote_item.product_id = target_product_id;

  return jsonb_build_object(
    'product_id', product_row.id,
    'maker_id', product_row.maker_id,
    'slug', product_row.slug,
    'editorial_status', product_row.status,
    'published_version_id', product_row.published_version_id,
    'availability_status', availability_row.status,
    'availability_version', availability_row.version,
    'references', jsonb_build_object(
      'quotes', quote_count,
      'customization_projects', customization_count,
      'orders', order_count
    ),
    'can_hard_delete',
      product_row.status in ('draft', 'rejected')
      and product_row.published_version_id is null
      and quote_count = 0 and customization_count = 0 and order_count = 0,
    'recommended_action',
      case
        when product_row.status in ('draft', 'rejected')
          and product_row.published_version_id is null
          and quote_count = 0 and customization_count = 0 and order_count = 0
          then 'delete_draft'
        when product_row.status <> 'archived' then 'archive'
        else 'none'
      end
  );
end;
$$;

revoke all on function public.server_set_product_availability(
  uuid, bigint, bigint, text, text, timestamptz, integer, uuid, text
) from public, anon, authenticated;
revoke all on function public.server_archive_product(
  uuid, bigint, bigint, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.server_restore_archived_product(
  uuid, bigint, bigint, uuid
) from public, anon, authenticated;
revoke all on function public.server_delete_product_draft(
  uuid, bigint, bigint, text, uuid
) from public, anon, authenticated;
revoke all on function public.server_adjust_variant_inventory(
  uuid, bigint, bigint, text, integer, text, integer, uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.server_get_product_reference_impact(
  uuid, bigint, bigint
) from public, anon, authenticated;

grant execute on function public.server_set_product_availability(
  uuid, bigint, bigint, text, text, timestamptz, integer, uuid, text
) to service_role;
grant execute on function public.server_archive_product(
  uuid, bigint, bigint, text, uuid, text
) to service_role;
grant execute on function public.server_restore_archived_product(
  uuid, bigint, bigint, uuid
) to service_role;
grant execute on function public.server_delete_product_draft(
  uuid, bigint, bigint, text, uuid
) to service_role;
grant execute on function public.server_adjust_variant_inventory(
  uuid, bigint, bigint, text, integer, text, integer, uuid, uuid, text
) to service_role;
grant execute on function public.server_get_product_reference_impact(
  uuid, bigint, bigint
) to service_role;

