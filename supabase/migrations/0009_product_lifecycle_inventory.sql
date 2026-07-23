create table catalog.product_availability (
  product_id bigint primary key references catalog.products(id) on delete cascade,
  status text not null default 'available'
    check (status in ('available', 'paused', 'out_of_stock', 'discontinued')),
  reason_code text,
  seller_note text,
  expected_available_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'available' or expected_available_at is null)
);
create index product_availability_status_idx
  on catalog.product_availability(status, updated_at desc);
create index product_availability_updated_by_idx
  on catalog.product_availability(updated_by)
  where updated_by is not null;

create table catalog.variant_inventory (
  variant_id bigint primary key references catalog.product_variants(id) on delete cascade,
  tracking_mode text not null default 'not_tracked'
    check (tracking_mode in ('not_tracked', 'finite_stock', 'made_to_order')),
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  safety_stock integer not null default 0 check (safety_stock >= 0),
  available_to_sell integer generated always as (
    greatest(on_hand - reserved - safety_stock, 0)
  ) stored,
  restock_expected_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved <= on_hand),
  check (
    tracking_mode = 'finite_stock'
    or (on_hand = 0 and reserved = 0 and safety_stock = 0)
  )
);
create index variant_inventory_restock_idx
  on catalog.variant_inventory(restock_expected_at)
  where restock_expected_at is not null;

create table catalog.product_status_history (
  id bigint generated always as identity primary key,
  product_id bigint not null references catalog.products(id) on delete cascade,
  from_status text,
  to_status text not null
    check (to_status in ('draft', 'in_review', 'published', 'rejected', 'archived')),
  actor_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'seller'
    check (source in ('seller', 'agent_confirmed', 'system')),
  reason text,
  request_key uuid not null,
  created_at timestamptz not null default now(),
  unique (product_id, request_key)
);
create index product_status_history_product_idx
  on catalog.product_status_history(product_id, created_at desc);
create index product_status_history_actor_idx
  on catalog.product_status_history(actor_user_id)
  where actor_user_id is not null;

create table catalog.product_availability_history (
  id bigint generated always as identity primary key,
  product_id bigint not null references catalog.products(id) on delete cascade,
  from_status text,
  to_status text not null
    check (to_status in ('available', 'paused', 'out_of_stock', 'discontinued')),
  previous_expected_available_at timestamptz,
  new_expected_available_at timestamptz,
  actor_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'seller'
    check (source in ('seller', 'agent_confirmed', 'system')),
  reason text,
  request_key uuid not null,
  created_at timestamptz not null default now(),
  unique (product_id, request_key)
);
create index product_availability_history_product_idx
  on catalog.product_availability_history(product_id, created_at desc);
create index product_availability_history_actor_idx
  on catalog.product_availability_history(actor_user_id)
  where actor_user_id is not null;

create table catalog.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id bigint not null references catalog.product_variants(id) on delete restrict,
  movement_type text not null
    check (movement_type in ('receive', 'reserve', 'release', 'sell', 'adjust')),
  quantity integer not null check (quantity > 0),
  order_id uuid references commerce.orders(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'seller'
    check (source in ('seller', 'agent_confirmed', 'system')),
  reason text,
  request_key uuid not null,
  resulting_on_hand integer not null check (resulting_on_hand >= 0),
  resulting_reserved integer not null check (resulting_reserved >= 0),
  created_at timestamptz not null default now(),
  unique (variant_id, request_key)
);
create index inventory_movements_variant_idx
  on catalog.inventory_movements(variant_id, created_at desc);
create index inventory_movements_order_idx
  on catalog.inventory_movements(order_id)
  where order_id is not null;
create index inventory_movements_actor_idx
  on catalog.inventory_movements(actor_user_id)
  where actor_user_id is not null;

create table internal.product_command_receipts (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  command_type text not null,
  product_id bigint,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_user_id, request_key)
);
create index product_command_receipts_product_idx
  on internal.product_command_receipts(product_id, created_at desc)
  where product_id is not null;

create table internal.storage_cleanup_jobs (
  id bigint generated always as identity primary key,
  media_asset_id bigint not null references catalog.media_assets(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (media_asset_id)
);
create index storage_cleanup_jobs_pending_idx
  on internal.storage_cleanup_jobs(next_attempt_at, id)
  where status in ('pending', 'failed');

create or replace function internal.create_product_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_request_key uuid := extensions.gen_random_uuid();
begin
  insert into catalog.product_availability(product_id)
  values (new.id)
  on conflict (product_id) do nothing;

  insert into catalog.product_availability_history(
    product_id,
    from_status,
    to_status,
    source,
    reason,
    request_key
  )
  values (
    new.id,
    null,
    'available',
    'system',
    'product_created',
    initial_request_key
  )
  on conflict (product_id, request_key) do nothing;

  return new;
end;
$$;

create trigger products_create_availability
after insert on catalog.products
for each row execute function internal.create_product_availability();

insert into catalog.product_availability(product_id, status)
select p.id, case when p.status = 'archived' then 'discontinued' else 'available' end
from catalog.products p
on conflict (product_id) do nothing;

insert into catalog.product_availability_history(
  product_id,
  from_status,
  to_status,
  source,
  reason,
  request_key
)
select
  pa.product_id,
  null,
  pa.status,
  'system',
  'migration_backfill',
  extensions.gen_random_uuid()
from catalog.product_availability pa
where not exists (
  select 1
  from catalog.product_availability_history h
  where h.product_id = pa.product_id
);

create or replace view public.published_products
with (security_invoker = true)
as
select
  p.id,
  p.slug,
  p.maker_id,
  m.display_name as maker_name,
  m.province_code,
  pv.id as product_version_id,
  pv.production_model,
  pv.customizable,
  pv.minimum_order_quantity,
  pv.lead_time_min_days,
  pv.lead_time_max_days,
  pl.locale,
  pl.title,
  pl.short_description,
  pl.story,
  price.currency_code,
  price.unit_amount as price_from
from catalog.products p
join catalog.product_availability pa
  on pa.product_id = p.id and pa.status = 'available'
join catalog.product_versions pv on pv.id = p.published_version_id
join catalog.product_localizations pl on pl.product_version_id = pv.id
join catalog.makers m on m.id = p.maker_id
left join lateral (
  select pr.currency_code, min(pr.unit_amount) as unit_amount
  from catalog.price_rules pr
  where pr.product_version_id = pv.id
    and pr.price_type <> 'quote_only'
    and (pr.valid_until is null or pr.valid_until > now())
  group by pr.currency_code
  order by case when pr.currency_code = 'USDC' then 0 else 1 end
  limit 1
) price on true
where p.status = 'published'
  and pv.workflow_status = 'published'
  and m.verification_status = 'verified'
  and exists (
    select 1
    from catalog.product_variants variant
    left join catalog.variant_inventory inventory on inventory.variant_id = variant.id
    where variant.product_version_id = pv.id
      and variant.active
      and (
        inventory.variant_id is null
        or inventory.tracking_mode in ('not_tracked', 'made_to_order')
        or inventory.available_to_sell > 0
      )
  );

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

create or replace function public.archive_product(
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
declare
  actor_id uuid := (select auth.uid());
  product_row catalog.products%rowtype;
  availability_row catalog.product_availability%rowtype;
  cached internal.product_command_receipts%rowtype;
  old_status text;
  result jsonb;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if request_key is null then raise exception 'REQUEST_KEY_REQUIRED'; end if;
  if source not in ('seller', 'agent_confirmed') then raise exception 'INVALID_SOURCE'; end if;

  select * into cached
  from internal.product_command_receipts r
  where r.actor_user_id = actor_id and r.request_key = archive_product.request_key;
  if found then
    if cached.command_type <> 'archive_product' or cached.product_id <> target_product_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return cached.response;
  end if;

  select * into product_row from catalog.products where id = target_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if not catalog.has_maker_role(product_row.maker_id, array['owner','manager','catalog_editor']) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  old_status := product_row.status;
  if old_status = 'archived' then
    result := jsonb_build_object('product_id', target_product_id, 'status', 'archived');
  else
    update catalog.products
    set status = 'archived', updated_at = now()
    where id = target_product_id;

    select * into availability_row
    from catalog.product_availability
    where product_id = target_product_id
    for update;

    update catalog.product_availability
    set
      status = 'discontinued',
      reason_code = 'archived',
      seller_note = nullif(trim(reason), ''),
      expected_available_at = null,
      updated_by = actor_id,
      version = version + 1,
      updated_at = now()
    where product_id = target_product_id;

    insert into catalog.product_status_history(
      product_id, from_status, to_status, actor_user_id, source, reason, request_key
    )
    values (
      target_product_id, old_status, 'archived', actor_id, source, nullif(trim(reason), ''), request_key
    );

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
      availability_row.status,
      'discontinued',
      availability_row.expected_available_at,
      null,
      actor_id,
      source,
      nullif(trim(reason), ''),
      request_key
    );

    result := jsonb_build_object(
      'product_id', target_product_id,
      'status', 'archived',
      'availability', 'discontinued'
    );
  end if;

  insert into internal.product_command_receipts(
    actor_user_id, request_key, command_type, product_id, response
  )
  values (actor_id, request_key, 'archive_product', target_product_id, result);

  return result;
end;
$$;

create or replace function public.restore_archived_product(
  target_product_id bigint,
  request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  product_row catalog.products%rowtype;
  availability_row catalog.product_availability%rowtype;
  cached internal.product_command_receipts%rowtype;
  result jsonb;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if request_key is null then raise exception 'REQUEST_KEY_REQUIRED'; end if;

  select * into cached
  from internal.product_command_receipts r
  where r.actor_user_id = actor_id and r.request_key = restore_archived_product.request_key;
  if found then
    if cached.command_type <> 'restore_archived_product' or cached.product_id <> target_product_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return cached.response;
  end if;

  select * into product_row from catalog.products where id = target_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if not catalog.has_maker_role(product_row.maker_id, array['owner','manager']) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if product_row.status <> 'archived' or product_row.published_version_id is null then
    raise exception 'PRODUCT_NOT_RESTORABLE';
  end if;
  if not exists (
    select 1 from catalog.makers
    where id = product_row.maker_id and verification_status = 'verified'
  ) then
    raise exception 'MAKER_NOT_VERIFIED';
  end if;
  if not exists (
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

  select * into availability_row
  from catalog.product_availability
  where product_id = target_product_id
  for update;

  update catalog.products
  set status = 'published', updated_at = now()
  where id = target_product_id;

  update catalog.product_availability
  set
    status = 'available',
    reason_code = null,
    seller_note = null,
    expected_available_at = null,
    updated_by = actor_id,
    version = version + 1,
    updated_at = now()
  where product_id = target_product_id;

  insert into catalog.product_status_history(
    product_id, from_status, to_status, actor_user_id, source, reason, request_key
  )
  values (
    target_product_id, 'archived', 'published', actor_id, 'seller', 'restored', request_key
  );

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
    availability_row.status,
    'available',
    availability_row.expected_available_at,
    null,
    actor_id,
    'seller',
    'restored',
    request_key
  );

  result := jsonb_build_object(
    'product_id', target_product_id,
    'status', 'published',
    'availability', 'available'
  );

  insert into internal.product_command_receipts(
    actor_user_id, request_key, command_type, product_id, response
  )
  values (actor_id, request_key, 'restore_archived_product', target_product_id, result);

  return result;
end;
$$;

create or replace function public.delete_product_draft(
  target_product_id bigint,
  confirmation_slug text,
  request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  product_row catalog.products%rowtype;
  cached internal.product_command_receipts%rowtype;
  media_count integer := 0;
  result jsonb;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if request_key is null then raise exception 'REQUEST_KEY_REQUIRED'; end if;

  select * into cached
  from internal.product_command_receipts r
  where r.actor_user_id = actor_id and r.request_key = delete_product_draft.request_key;
  if found then
    if cached.command_type <> 'delete_product_draft' or cached.product_id <> target_product_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return cached.response;
  end if;

  select * into product_row from catalog.products where id = target_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if not catalog.has_maker_role(product_row.maker_id, array['owner','manager','catalog_editor']) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if product_row.slug <> confirmation_slug then raise exception 'CONFIRMATION_MISMATCH'; end if;
  if product_row.status not in ('draft', 'rejected') or product_row.published_version_id is not null then
    raise exception 'PRODUCT_MUST_BE_ARCHIVED';
  end if;
  if exists (
    select 1 from commerce.quote_request_items where product_id = target_product_id
  ) or exists (
    select 1 from customization.projects where selected_product_id = target_product_id
  ) then
    raise exception 'PRODUCT_HAS_REFERENCES';
  end if;

  insert into internal.storage_cleanup_jobs(
    media_asset_id, storage_bucket, storage_path, reason
  )
  select distinct
    ma.id,
    ma.storage_bucket,
    ma.storage_path,
    'draft_product_deleted'
  from catalog.media_assets ma
  join catalog.product_media pm on pm.media_asset_id = ma.id
  join catalog.product_versions pv on pv.id = pm.product_version_id
  where pv.product_id = target_product_id
    and not exists (
      select 1
      from catalog.product_media other_pm
      join catalog.product_versions other_pv on other_pv.id = other_pm.product_version_id
      where other_pm.media_asset_id = ma.id
        and other_pv.product_id <> target_product_id
    )
  on conflict (media_asset_id) do nothing;

  get diagnostics media_count = row_count;

  result := jsonb_build_object(
    'product_id', target_product_id,
    'deleted', true,
    'media_cleanup_jobs', media_count
  );

  insert into internal.product_command_receipts(
    actor_user_id, request_key, command_type, product_id, response
  )
  values (actor_id, request_key, 'delete_product_draft', target_product_id, result);

  delete from catalog.products where id = target_product_id;
  return result;
end;
$$;

create or replace function public.adjust_variant_inventory(
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
declare
  actor_id uuid := (select auth.uid());
  inventory_row catalog.variant_inventory%rowtype;
  product_row catalog.products%rowtype;
  next_on_hand integer;
  next_reserved integer;
  result jsonb;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if request_key is null then raise exception 'REQUEST_KEY_REQUIRED'; end if;
  if quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  if movement_type not in ('receive', 'reserve', 'release', 'sell', 'adjust') then
    raise exception 'INVALID_MOVEMENT_TYPE';
  end if;
  if source not in ('seller', 'agent_confirmed') then raise exception 'INVALID_SOURCE'; end if;

  select p.* into product_row
  from catalog.product_variants pv
  join catalog.product_versions version on version.id = pv.product_version_id
  join catalog.products p on p.id = version.product_id
  where pv.id = target_variant_id;
  if not found then raise exception 'VARIANT_NOT_FOUND'; end if;
  if not catalog.has_maker_role(product_row.maker_id, array['owner','manager','catalog_editor','order_manager']) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if exists (
    select 1
    from catalog.inventory_movements im
    where im.variant_id = target_variant_id and im.request_key = adjust_variant_inventory.request_key
  ) then
    select jsonb_build_object(
      'variant_id', vi.variant_id,
      'on_hand', vi.on_hand,
      'reserved', vi.reserved,
      'available_to_sell', vi.available_to_sell,
      'version', vi.version
    )
    into result
    from catalog.variant_inventory vi
    where vi.variant_id = target_variant_id;
    return result;
  end if;

  insert into catalog.variant_inventory(variant_id, tracking_mode)
  values (target_variant_id, 'finite_stock')
  on conflict (variant_id) do nothing;

  select * into inventory_row
  from catalog.variant_inventory
  where variant_id = target_variant_id
  for update;

  if inventory_row.version <> expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if inventory_row.tracking_mode <> 'finite_stock' then raise exception 'INVENTORY_NOT_FINITE'; end if;

  next_on_hand := inventory_row.on_hand;
  next_reserved := inventory_row.reserved;

  case movement_type
    when 'receive' then next_on_hand := next_on_hand + quantity;
    when 'reserve' then
      if quantity > inventory_row.available_to_sell then raise exception 'INSUFFICIENT_STOCK'; end if;
      next_reserved := next_reserved + quantity;
    when 'release' then
      if quantity > next_reserved then raise exception 'RELEASE_EXCEEDS_RESERVED'; end if;
      next_reserved := next_reserved - quantity;
    when 'sell' then
      if quantity > next_reserved or quantity > next_on_hand then raise exception 'SELL_EXCEEDS_RESERVED'; end if;
      next_reserved := next_reserved - quantity;
      next_on_hand := next_on_hand - quantity;
    when 'adjust' then next_on_hand := quantity;
  end case;

  if next_reserved > next_on_hand then raise exception 'RESERVED_EXCEEDS_ON_HAND'; end if;

  update catalog.variant_inventory
  set
    on_hand = next_on_hand,
    reserved = next_reserved,
    version = version + 1,
    updated_at = now()
  where variant_id = target_variant_id
  returning * into inventory_row;

  insert into catalog.inventory_movements(
    variant_id,
    movement_type,
    quantity,
    order_id,
    actor_user_id,
    source,
    reason,
    request_key,
    resulting_on_hand,
    resulting_reserved
  )
  values (
    target_variant_id,
    movement_type,
    quantity,
    target_order_id,
    actor_id,
    source,
    nullif(trim(reason), ''),
    request_key,
    inventory_row.on_hand,
    inventory_row.reserved
  );

  result := jsonb_build_object(
    'variant_id', inventory_row.variant_id,
    'on_hand', inventory_row.on_hand,
    'reserved', inventory_row.reserved,
    'available_to_sell', inventory_row.available_to_sell,
    'version', inventory_row.version
  );
  return result;
end;
$$;

alter table catalog.product_availability enable row level security;
alter table catalog.variant_inventory enable row level security;
alter table catalog.product_status_history enable row level security;
alter table catalog.product_availability_history enable row level security;
alter table catalog.inventory_movements enable row level security;
alter table internal.product_command_receipts enable row level security;
alter table internal.storage_cleanup_jobs enable row level security;

create policy product_command_receipts_deny_client
on internal.product_command_receipts
for all to authenticated
using (false)
with check (false);

create policy storage_cleanup_jobs_deny_client
on internal.storage_cleanup_jobs
for all to authenticated
using (false)
with check (false);

create policy product_availability_public_select
on catalog.product_availability
for select to anon, authenticated
using (
  exists (
    select 1
    from catalog.products p
    where p.id = product_id
      and (p.status = 'published' or catalog.has_maker_role(p.maker_id))
  )
);

create policy variant_inventory_member_select
on catalog.variant_inventory
for select to authenticated
using (
  exists (
    select 1
    from catalog.product_variants pv
    join catalog.product_versions version on version.id = pv.product_version_id
    join catalog.products p on p.id = version.product_id
    where pv.id = variant_id and catalog.has_maker_role(p.maker_id)
  )
);

create policy product_status_history_member_select
on catalog.product_status_history
for select to authenticated
using (
  exists (
    select 1 from catalog.products p
    where p.id = product_id and catalog.has_maker_role(p.maker_id)
  )
);

create policy product_availability_history_member_select
on catalog.product_availability_history
for select to authenticated
using (
  exists (
    select 1 from catalog.products p
    where p.id = product_id and catalog.has_maker_role(p.maker_id)
  )
);

create policy inventory_movements_member_select
on catalog.inventory_movements
for select to authenticated
using (
  exists (
    select 1
    from catalog.product_variants pv
    join catalog.product_versions version on version.id = pv.product_version_id
    join catalog.products p on p.id = version.product_id
    where pv.id = variant_id and catalog.has_maker_role(p.maker_id)
  )
);

grant select on catalog.product_availability to anon, authenticated;
grant select on catalog.variant_inventory,
  catalog.product_status_history,
  catalog.product_availability_history,
  catalog.inventory_movements
to authenticated;

revoke all on internal.product_command_receipts from anon, authenticated;
revoke all on internal.storage_cleanup_jobs from anon, authenticated;

revoke all on function public.set_product_availability(
  bigint, text, text, timestamptz, integer, uuid, text
) from public, anon;
revoke all on function public.archive_product(bigint, text, uuid, text) from public, anon;
revoke all on function public.restore_archived_product(bigint, uuid) from public, anon;
revoke all on function public.delete_product_draft(bigint, text, uuid) from public, anon;
revoke all on function public.adjust_variant_inventory(
  bigint, text, integer, text, integer, uuid, uuid, text
) from public, anon;

grant execute on function public.set_product_availability(
  bigint, text, text, timestamptz, integer, uuid, text
) to service_role;
grant execute on function public.archive_product(bigint, text, uuid, text) to service_role;
grant execute on function public.restore_archived_product(bigint, uuid) to service_role;
grant execute on function public.delete_product_draft(bigint, text, uuid) to service_role;
grant execute on function public.adjust_variant_inventory(
  bigint, text, integer, text, integer, uuid, uuid, text
) to service_role;
