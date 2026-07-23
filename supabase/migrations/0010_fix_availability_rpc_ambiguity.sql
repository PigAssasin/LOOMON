create or replace function public.set_product_availability(
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
declare
  actor_id uuid := (select auth.uid());
  product_row catalog.products%rowtype;
  current_row catalog.product_availability%rowtype;
  cached internal.product_command_receipts%rowtype;
  previous_status text;
  previous_expected_available_at timestamptz;
  result jsonb;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if request_key is null then raise exception 'REQUEST_KEY_REQUIRED'; end if;
  if target_status not in ('available', 'paused', 'out_of_stock', 'discontinued') then
    raise exception 'INVALID_AVAILABILITY_STATUS';
  end if;
  if source not in ('seller', 'agent_confirmed') then raise exception 'INVALID_SOURCE'; end if;

  select * into cached
  from internal.product_command_receipts r
  where r.actor_user_id = actor_id and r.request_key = set_product_availability.request_key;
  if found then
    if cached.command_type <> 'set_product_availability' or cached.product_id <> target_product_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return cached.response;
  end if;

  select * into product_row from catalog.products where id = target_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if not catalog.has_maker_role(product_row.maker_id, array['owner','manager','catalog_editor','order_manager']) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into current_row
  from catalog.product_availability
  where product_id = target_product_id
  for update;

  if current_row.version <> expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if target_status = 'available' and product_row.status <> 'published' then
    raise exception 'PRODUCT_NOT_PUBLISHED';
  end if;
  if target_status = 'available' and not exists (
    select 1
    from catalog.product_variants pv
    left join catalog.variant_inventory vi on vi.variant_id = pv.id
    where pv.product_version_id = product_row.published_version_id
      and pv.active
      and (
        vi.variant_id is null
        or vi.tracking_mode in ('not_tracked', 'made_to_order')
        or vi.available_to_sell > 0
      )
  ) then
    raise exception 'NO_SELLABLE_VARIANT';
  end if;

  previous_status := current_row.status;
  previous_expected_available_at := current_row.expected_available_at;

  update catalog.product_availability
  set
    status = target_status,
    reason_code = nullif(trim(reason), ''),
    seller_note = nullif(trim(reason), ''),
    expected_available_at = case
      when target_status = 'available' then null
      else set_product_availability.expected_available_at
    end,
    updated_by = actor_id,
    version = version + 1,
    updated_at = now()
  where product_id = target_product_id
  returning * into current_row;

  insert into catalog.product_availability_history(
    product_id,
    from_status,
    to_status,
    previous_expected_available_at,
    new_expected_available_at,
    actor_user_id,
    source,
    reason,
    request_key
  )
  values (
    target_product_id,
    previous_status,
    target_status,
    previous_expected_available_at,
    current_row.expected_available_at,
    actor_id,
    source,
    nullif(trim(reason), ''),
    request_key
  );

  result := jsonb_build_object(
    'product_id', target_product_id,
    'status', current_row.status,
    'expected_available_at', current_row.expected_available_at,
    'version', current_row.version
  );

  insert into internal.product_command_receipts(
    actor_user_id, request_key, command_type, product_id, response
  )
  values (actor_id, request_key, 'set_product_availability', target_product_id, result);

  return result;
end;
$$;
