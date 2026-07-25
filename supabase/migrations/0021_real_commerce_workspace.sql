-- Real buyer/seller workspace, profile, delivery confirmation and proof gates.

alter table public.profiles
  add column if not exists email text,
  add column if not exists location text,
  add column if not exists bio text;

alter table commerce.quote_requests
  add column if not exists public_reference text,
  add column if not exists seller_response_note text,
  add column if not exists decided_at timestamptz;

update commerce.quote_requests
set public_reference = 'LM-RQ-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where public_reference is null;

alter table commerce.quote_requests
  alter column public_reference set not null;

create unique index if not exists quote_requests_public_reference_idx
  on commerce.quote_requests(public_reference);

alter table commerce.quote_requests
  drop constraint if exists quote_requests_status_check;
alter table commerce.quote_requests
  add constraint quote_requests_status_check
  check (status in (
    'draft', 'submitted', 'seller_review', 'changes_requested', 'quoted',
    'accepted', 'rejected', 'expired', 'cancelled', 'withdrawn'
  ));

create table if not exists commerce.quote_request_status_history (
  id bigint generated always as identity primary key,
  quote_request_id uuid not null
    references commerce.quote_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_type text not null
    check (actor_type in ('buyer', 'seller', 'agent', 'system')),
  actor_id uuid,
  reason text,
  correlation_id uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index if not exists quote_request_history_request_idx
  on commerce.quote_request_status_history(quote_request_id, created_at);

alter table commerce.orders
  add column if not exists client_request_key uuid,
  add column if not exists seller_marked_delivered_at timestamptz,
  add column if not exists buyer_confirmed_received_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

create unique index if not exists orders_accept_request_key_idx
  on commerce.orders(maker_id, client_request_key)
  where client_request_key is not null;

create unique index if not exists orders_accepted_quote_version_idx
  on commerce.orders(accepted_quote_version_id);

alter table commerce.orders
  drop constraint if exists orders_status_check;
alter table commerce.orders
  add constraint orders_status_check
  check (status in (
    'deposit_pending', 'deposit_paid', 'production_confirmed',
    'design_approval_pending', 'in_production', 'ready', 'completed',
    'seller_accepted', 'in_progress', 'seller_marked_delivered',
    'delivery_disputed', 'buyer_confirmed_received', 'proof_pending',
    'proof_minted', 'cancelled'
  ));

alter table commerce.quote_request_status_history enable row level security;

drop policy if exists quote_request_history_participant_select
  on commerce.quote_request_status_history;
create policy quote_request_history_participant_select
on commerce.quote_request_status_history for select to authenticated
using (
  exists (
    select 1
    from commerce.quote_requests request
    where request.id = quote_request_id
      and (
        request.buyer_id = (select auth.uid())
        or catalog.has_maker_role(request.maker_id)
      )
  )
);

grant select on commerce.quote_request_status_history to authenticated;
grant usage, select on sequence commerce.quote_request_status_history_id_seq
  to authenticated, service_role;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, display_name, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_created_profile on auth.users;
create trigger auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_profile();

insert into public.profiles(user_id, display_name, email)
select
  user_record.id,
  nullif(user_record.raw_user_meta_data ->> 'display_name', ''),
  user_record.email
from auth.users user_record
on conflict (user_id) do nothing;

create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'userId', profile.user_id,
    'displayName', profile.display_name,
    'email', profile.email,
    'location', profile.location,
    'bio', profile.bio,
    'preferredLocale', profile.preferred_locale,
    'timezone', profile.timezone,
    'wallet', (
      select jsonb_build_object(
        'address', account.address,
        'chainId', account.chain_id,
        'verifiedAt', account.verified_at
      )
      from wallet.accounts account
      where account.user_id = profile.user_id
        and account.is_primary
      order by account.created_at desc
      limit 1
    ),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'makerId', maker.id,
        'makerSlug', maker.slug,
        'makerName', maker.display_name,
        'role', membership.role
      ) order by maker.display_name)
      from catalog.maker_memberships membership
      join catalog.makers maker on maker.id = membership.maker_id
      where membership.user_id = profile.user_id
        and membership.status = 'active'
    ), '[]'::jsonb)
  )
  from public.profiles profile
  where profile.user_id = auth.uid();
$$;

create or replace function public.update_my_profile(
  p_display_name text,
  p_email text,
  p_location text,
  p_bio text,
  p_preferred_locale text default 'en'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if nullif(btrim(p_display_name), '') is null then
    raise exception 'display_name_required' using errcode = '22023';
  end if;
  if p_email is not null and btrim(p_email) <> ''
    and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_preferred_locale not in ('vi', 'en') then
    raise exception 'invalid_locale' using errcode = '22023';
  end if;

  insert into public.profiles(
    user_id, display_name, email, location, bio, preferred_locale, updated_at
  )
  values (
    actor_id,
    btrim(p_display_name),
    nullif(btrim(p_email), ''),
    nullif(btrim(p_location), ''),
    nullif(btrim(p_bio), ''),
    p_preferred_locale,
    now()
  )
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    email = excluded.email,
    location = excluded.location,
    bio = excluded.bio,
    preferred_locale = excluded.preferred_locale,
    updated_at = now();

  return public.get_my_profile();
end;
$$;

create or replace function public.sync_my_web3_wallet(p_address text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  account_record wallet.accounts%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_address !~ '^0x[0-9a-fA-F]{40}$' then
    raise exception 'invalid_wallet_address' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from auth.identities identity_record
    where identity_record.user_id = actor_id
      and lower(identity_record.identity_data::text) like
        ('%' || lower(p_address) || '%')
  ) then
    raise exception 'wallet_identity_mismatch' using errcode = '42501';
  end if;

  update wallet.accounts
  set is_primary = false
  where user_id = actor_id and is_primary;

  insert into wallet.accounts(
    user_id, provider, wallet_type, custody_type, chain_id, address,
    is_primary, verified_at
  )
  values (
    actor_id, 'supabase_web3', 'external', 'user_controlled', 5042002,
    lower(p_address), true, now()
  )
  on conflict (user_id, chain_id, address) do update
  set is_primary = true, verified_at = now()
  returning * into account_record;

  return jsonb_build_object(
    'address', account_record.address,
    'chainId', account_record.chain_id,
    'verified', true
  );
end;
$$;

create or replace function public.list_claimable_demo_makers()
returns table(id bigint, slug text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select maker.id, maker.slug, maker.display_name
  from catalog.makers maker
  where maker.verification_status <> 'suspended'
    and not exists (
      select 1
      from catalog.maker_memberships membership
      where membership.maker_id = maker.id
        and membership.role = 'owner'
        and membership.status = 'active'
    )
  order by maker.display_name;
$$;

create or replace function public.claim_demo_maker(p_maker_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  maker_record catalog.makers%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into maker_record
  from catalog.makers
  where id = p_maker_id
    and verification_status <> 'suspended'
  for update;
  if not found then raise exception 'maker_not_found'; end if;

  if exists (
    select 1 from catalog.maker_memberships
    where maker_id = p_maker_id
      and role = 'owner'
      and status = 'active'
      and user_id <> actor_id
  ) then
    raise exception 'maker_already_claimed' using errcode = '23505';
  end if;

  insert into catalog.maker_memberships(maker_id, user_id, role, status)
  values (p_maker_id, actor_id, 'owner', 'active')
  on conflict (maker_id, user_id) do update
  set role = 'owner', status = 'active', updated_at = now();

  return jsonb_build_object(
    'makerId', maker_record.id,
    'makerSlug', maker_record.slug,
    'makerName', maker_record.display_name,
    'role', 'owner'
  );
end;
$$;

create or replace function public.get_my_commerce_workspace()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'buyingRequests', coalesce((
      select jsonb_agg(row_data order by (row_data ->> 'updatedAt') desc)
      from (
        select jsonb_build_object(
          'kind', 'request',
          'id', request.id,
          'reference', request.public_reference,
          'status', request.status,
          'requiredBy', request.required_by,
          'note', request.buyer_note,
          'sellerNote', request.seller_response_note,
          'createdAt', request.created_at,
          'updatedAt', request.updated_at,
          'makerId', maker.id,
          'makerName', maker.display_name,
          'productId', product.id,
          'productSlug', product.slug,
          'productTitle', coalesce(localized.title, product.slug),
          'quantity', item.quantity,
          'threadId', thread.id
        ) as row_data
        from commerce.quote_requests request
        join catalog.makers maker on maker.id = request.maker_id
        join commerce.quote_request_items item
          on item.quote_request_id = request.id
        join catalog.products product on product.id = item.product_id
        left join catalog.product_localizations localized
          on localized.product_version_id = item.product_version_id
          and localized.locale = 'en'
        left join messaging.threads thread
          on thread.project_id = request.project_id
          and thread.thread_type = 'buyer_seller'
        where request.buyer_id = auth.uid()
      ) buying_request_rows
    ), '[]'::jsonb),
    'sellingRequests', coalesce((
      select jsonb_agg(row_data order by (row_data ->> 'updatedAt') desc)
      from (
        select jsonb_build_object(
          'kind', 'request',
          'id', request.id,
          'reference', request.public_reference,
          'status', request.status,
          'requiredBy', request.required_by,
          'note', request.buyer_note,
          'sellerNote', request.seller_response_note,
          'createdAt', request.created_at,
          'updatedAt', request.updated_at,
          'makerId', maker.id,
          'makerName', maker.display_name,
          'buyerName', coalesce(profile.display_name, 'Buyer'),
          'productId', product.id,
          'productSlug', product.slug,
          'productTitle', coalesce(localized.title, product.slug),
          'quantity', item.quantity,
          'threadId', thread.id
        ) as row_data
        from commerce.quote_requests request
        join catalog.makers maker on maker.id = request.maker_id
        join commerce.quote_request_items item
          on item.quote_request_id = request.id
        join catalog.products product on product.id = item.product_id
        left join public.profiles profile on profile.user_id = request.buyer_id
        left join catalog.product_localizations localized
          on localized.product_version_id = item.product_version_id
          and localized.locale = 'en'
        left join messaging.threads thread
          on thread.project_id = request.project_id
          and thread.thread_type = 'buyer_seller'
        where catalog.has_maker_role(
          request.maker_id,
          array['owner', 'manager', 'order_manager']
        )
      ) selling_request_rows
    ), '[]'::jsonb),
    'buyingOrders', coalesce((
      select jsonb_agg(row_data order by (row_data ->> 'updatedAt') desc)
      from (
        select jsonb_build_object(
          'kind', 'order',
          'id', order_record.id,
          'reference', order_record.order_number,
          'status', order_record.status,
          'createdAt', order_record.created_at,
          'updatedAt', order_record.updated_at,
          'deliveredAt', order_record.seller_marked_delivered_at,
          'receivedAt', order_record.buyer_confirmed_received_at,
          'makerId', maker.id,
          'makerName', maker.display_name,
          'productId', product.id,
          'productSlug', product.slug,
          'productTitle', coalesce(localized.title, product.slug),
          'quantity', item.quantity,
          'threadId', thread.id
        ) as row_data
        from commerce.orders order_record
        join catalog.makers maker on maker.id = order_record.maker_id
        join commerce.quote_versions quote_version
          on quote_version.id = order_record.accepted_quote_version_id
        join commerce.quote_request_items item
          on item.quote_request_id = quote_version.quote_request_id
        join catalog.products product on product.id = item.product_id
        left join catalog.product_localizations localized
          on localized.product_version_id = item.product_version_id
          and localized.locale = 'en'
        left join messaging.threads thread on thread.order_id = order_record.id
        where order_record.buyer_id = auth.uid()
      ) buying_order_rows
    ), '[]'::jsonb),
    'sellingOrders', coalesce((
      select jsonb_agg(row_data order by (row_data ->> 'updatedAt') desc)
      from (
        select jsonb_build_object(
          'kind', 'order',
          'id', order_record.id,
          'reference', order_record.order_number,
          'status', order_record.status,
          'createdAt', order_record.created_at,
          'updatedAt', order_record.updated_at,
          'deliveredAt', order_record.seller_marked_delivered_at,
          'receivedAt', order_record.buyer_confirmed_received_at,
          'makerId', maker.id,
          'makerName', maker.display_name,
          'buyerName', coalesce(profile.display_name, 'Buyer'),
          'productId', product.id,
          'productSlug', product.slug,
          'productTitle', coalesce(localized.title, product.slug),
          'quantity', item.quantity,
          'threadId', thread.id
        ) as row_data
        from commerce.orders order_record
        join catalog.makers maker on maker.id = order_record.maker_id
        join commerce.quote_versions quote_version
          on quote_version.id = order_record.accepted_quote_version_id
        join commerce.quote_request_items item
          on item.quote_request_id = quote_version.quote_request_id
        join catalog.products product on product.id = item.product_id
        left join public.profiles profile on profile.user_id = order_record.buyer_id
        left join catalog.product_localizations localized
          on localized.product_version_id = item.product_version_id
          and localized.locale = 'en'
        left join messaging.threads thread on thread.order_id = order_record.id
        where catalog.has_maker_role(
          order_record.maker_id,
          array['owner', 'manager', 'order_manager']
        )
      ) selling_order_rows
    ), '[]'::jsonb)
  );
$$;

create or replace function public.transition_quote_request(
  p_request_id uuid,
  p_action text,
  p_reason text,
  p_request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  request_record commerce.quote_requests%rowtype;
  item_record commerce.quote_request_items%rowtype;
  quote_record commerce.quote_versions%rowtype;
  order_record commerce.orders%rowtype;
  previous_status text;
  target_status text;
  actor_kind text;
  unit_price numeric(20,6);
  total_price numeric(20,6);
  target_thread_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'request_key_required' using errcode = '22023';
  end if;

  select * into request_record
  from commerce.quote_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'request_not_found'; end if;

  select * into item_record
  from commerce.quote_request_items
  where quote_request_id = request_record.id
  order by id
  limit 1;

  previous_status := request_record.status;

  if p_action = 'withdraw' then
    if request_record.buyer_id <> actor_id then
      raise exception 'buyer_access_required' using errcode = '42501';
    end if;
    if previous_status not in ('submitted', 'seller_review', 'changes_requested') then
      raise exception 'request_not_withdrawable' using errcode = '22023';
    end if;
    target_status := 'withdrawn';
    actor_kind := 'buyer';
  else
    if not catalog.has_maker_role(
      request_record.maker_id,
      array['owner', 'manager', 'order_manager']
    ) then
      raise exception 'seller_access_required' using errcode = '42501';
    end if;
    actor_kind := 'seller';
    if p_action = 'accept' then
      target_status := 'accepted';
    elsif p_action = 'reject' then
      target_status := 'rejected';
    elsif p_action = 'request_changes' then
      target_status := 'changes_requested';
    else
      raise exception 'invalid_request_action' using errcode = '22023';
    end if;
    if previous_status not in ('submitted', 'seller_review', 'changes_requested') then
      raise exception 'request_not_actionable' using errcode = '22023';
    end if;
  end if;

  if p_action in ('reject', 'request_changes', 'withdraw')
    and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  if p_action = 'accept' then
    select * into order_record
    from commerce.orders
    where maker_id = request_record.maker_id
      and client_request_key = p_request_key;
    if found then return jsonb_build_object(
      'requestId', request_record.id,
      'orderId', order_record.id,
      'orderReference', order_record.order_number,
      'status', order_record.status,
      'idempotent', true
    ); end if;

    select coalesce(price.unit_amount, 0)
    into unit_price
    from catalog.price_rules price
    where price.product_version_id = item_record.product_version_id
      and price.currency_code = 'USDC'
      and price.minimum_quantity <= item_record.quantity
      and (price.maximum_quantity is null or price.maximum_quantity >= item_record.quantity)
      and price.valid_from <= now()
      and (price.valid_until is null or price.valid_until > now())
    order by price.minimum_quantity desc, price.id desc
    limit 1;
    unit_price := coalesce(unit_price, 0);
    total_price := unit_price * item_record.quantity;

    insert into commerce.quote_versions(
      quote_request_id, version_number, status, currency_code, subtotal,
      customization_total, total, deposit_percentage, snapshot, issued_at
    )
    values (
      request_record.id,
      coalesce((
        select max(version_number) + 1
        from commerce.quote_versions
        where quote_request_id = request_record.id
      ), 1),
      'accepted',
      'USDC',
      total_price,
      0,
      total_price,
      0,
      jsonb_build_object(
        'unitPrice', unit_price,
        'quantity', item_record.quantity,
        'demo', true,
        'acceptedBy', actor_id
      ),
      now()
    )
    returning * into quote_record;

    insert into commerce.orders(
      order_number, buyer_id, maker_id, accepted_quote_version_id, status,
      client_request_key
    )
    values (
      'LM-' || to_char(now(), 'YY-MM-') ||
        upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6)),
      request_record.buyer_id,
      request_record.maker_id,
      quote_record.id,
      'seller_accepted',
      p_request_key
    )
    returning * into order_record;

    if request_record.project_id is not null and request_record.brief_id is not null then
      insert into commerce.order_briefs(
        order_id, project_id, brief_id, selected_render_candidate_id, terms_hash
      )
      select
        order_record.id,
        request_record.project_id,
        request_record.brief_id,
        brief.selected_candidate_id,
        encode(extensions.digest(
          order_record.id::text || ':' || request_record.brief_id::text,
          'sha256'
        ), 'hex')
      from customization.briefs brief
      where brief.id = request_record.brief_id
      on conflict (order_id) do nothing;
    end if;

    update messaging.threads
    set order_id = order_record.id, updated_at = now()
    where project_id = request_record.project_id
      and thread_type = 'buyer_seller'
    returning id into target_thread_id;

    insert into commerce.order_status_history(
      order_id, from_status, to_status, actor_type, actor_id, reason
    )
    values (
      order_record.id, null, 'seller_accepted', 'seller', actor_id,
      'Seller accepted the demo order request'
    );
  end if;

  update commerce.quote_requests
  set
    status = target_status,
    seller_response_note = case
      when actor_kind = 'seller' then nullif(btrim(coalesce(p_reason, '')), '')
      else seller_response_note
    end,
    decided_at = case
      when target_status in ('accepted', 'rejected', 'withdrawn') then now()
      else decided_at
    end,
    updated_at = now()
  where id = request_record.id;

  insert into commerce.quote_request_status_history(
    quote_request_id, from_status, to_status, actor_type, actor_id, reason,
    correlation_id
  )
  values (
    request_record.id, previous_status, target_status, actor_kind, actor_id,
    nullif(btrim(coalesce(p_reason, '')), ''), p_request_key
  );

  select id into target_thread_id
  from messaging.threads
  where project_id = request_record.project_id
    and thread_type = 'buyer_seller'
  limit 1;

  if target_thread_id is not null then
    insert into messaging.messages(
      thread_id, sender_type, message_kind, structured_body,
      approval_status, sent_at
    )
    values (
      target_thread_id,
      'system',
      'status_update',
      jsonb_build_object(
        'event', 'quote_request_' || target_status,
        'requestId', request_record.id,
        'reason', nullif(btrim(coalesce(p_reason, '')), '')
      ),
      'sent',
      now()
    );
  end if;

  return jsonb_build_object(
    'requestId', request_record.id,
    'orderId', order_record.id,
    'orderReference', order_record.order_number,
    'status', target_status,
    'idempotent', false
  );
end;
$$;

create or replace function public.transition_demo_order(
  p_order_id uuid,
  p_action text,
  p_reason text,
  p_request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  order_record commerce.orders%rowtype;
  previous_status text;
  target_status text;
  actor_kind text;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'request_key_required' using errcode = '22023';
  end if;

  select * into order_record
  from commerce.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'order_not_found'; end if;
  previous_status := order_record.status;

  if p_action = 'mark_delivered' then
    if not catalog.has_maker_role(
      order_record.maker_id,
      array['owner', 'manager', 'order_manager']
    ) then
      raise exception 'seller_access_required' using errcode = '42501';
    end if;
    if previous_status not in ('seller_accepted', 'in_progress') then
      raise exception 'order_not_deliverable' using errcode = '22023';
    end if;
    target_status := 'seller_marked_delivered';
    actor_kind := 'seller';
  elsif p_action = 'confirm_received' then
    if order_record.buyer_id <> actor_id then
      raise exception 'buyer_access_required' using errcode = '42501';
    end if;
    if previous_status <> 'seller_marked_delivered' then
      raise exception 'delivery_not_ready_for_confirmation' using errcode = '22023';
    end if;
    target_status := 'buyer_confirmed_received';
    actor_kind := 'buyer';
  elsif p_action = 'report_issue' then
    if order_record.buyer_id <> actor_id then
      raise exception 'buyer_access_required' using errcode = '42501';
    end if;
    if previous_status <> 'seller_marked_delivered' then
      raise exception 'delivery_not_disputable' using errcode = '22023';
    end if;
    if nullif(btrim(coalesce(p_reason, '')), '') is null then
      raise exception 'reason_required' using errcode = '22023';
    end if;
    target_status := 'delivery_disputed';
    actor_kind := 'buyer';
  elsif p_action = 'cancel' then
    if order_record.buyer_id = actor_id then
      actor_kind := 'buyer';
    elsif catalog.has_maker_role(
      order_record.maker_id,
      array['owner', 'manager', 'order_manager']
    ) then
      actor_kind := 'seller';
    else
      raise exception 'order_access_required' using errcode = '42501';
    end if;
    if previous_status not in ('seller_accepted', 'in_progress') then
      raise exception 'order_not_cancellable' using errcode = '22023';
    end if;
    if nullif(btrim(coalesce(p_reason, '')), '') is null then
      raise exception 'reason_required' using errcode = '22023';
    end if;
    target_status := 'cancelled';
  else
    raise exception 'invalid_order_action' using errcode = '22023';
  end if;

  update commerce.orders
  set
    status = target_status,
    seller_marked_delivered_at = case
      when target_status = 'seller_marked_delivered' then now()
      else seller_marked_delivered_at
    end,
    buyer_confirmed_received_at = case
      when target_status = 'buyer_confirmed_received' then now()
      else buyer_confirmed_received_at
    end,
    cancelled_at = case when target_status = 'cancelled' then now() else cancelled_at end,
    cancellation_reason = case
      when target_status = 'cancelled' then btrim(p_reason)
      else cancellation_reason
    end,
    updated_at = now()
  where id = order_record.id;

  insert into commerce.order_status_history(
    order_id, from_status, to_status, actor_type, actor_id, reason,
    correlation_id
  )
  values (
    order_record.id, previous_status, target_status, actor_kind, actor_id,
    nullif(btrim(coalesce(p_reason, '')), ''), p_request_key
  );

  insert into messaging.messages(
    thread_id, sender_type, message_kind, structured_body,
    approval_status, sent_at
  )
  select
    thread.id,
    'system',
    'status_update',
    jsonb_build_object(
      'event', 'order_' || target_status,
      'orderId', order_record.id,
      'reason', nullif(btrim(coalesce(p_reason, '')), '')
    ),
    'sent',
    now()
  from messaging.threads thread
  where thread.order_id = order_record.id;

  return jsonb_build_object(
    'orderId', order_record.id,
    'orderReference', order_record.order_number,
    'status', target_status
  );
end;
$$;

create or replace function public.list_thread_messages(p_thread_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', message.id,
    'senderType', message.sender_type,
    'body', message.body,
    'kind', message.message_kind,
    'structuredBody', message.structured_body,
    'createdAt', message.created_at
  ) order by message.created_at), '[]'::jsonb)
  from messaging.messages message
  where message.thread_id = p_thread_id
    and messaging.can_access_thread(p_thread_id);
$$;

create or replace function public.send_thread_message(
  p_thread_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  participant_record messaging.thread_participants%rowtype;
  message_record messaging.messages%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_body, '')), '') is null then
    raise exception 'message_required' using errcode = '22023';
  end if;
  if char_length(btrim(p_body)) > 4000 then
    raise exception 'message_too_long' using errcode = '22023';
  end if;

  select participant.* into participant_record
  from messaging.thread_participants participant
  where participant.thread_id = p_thread_id
    and participant.left_at is null
    and participant.can_send
    and (
      participant.user_id = actor_id
      or (
        participant.maker_id is not null
        and catalog.has_maker_role(
          participant.maker_id,
          array['owner', 'manager', 'order_manager']
        )
      )
    )
  order by case when participant.user_id = actor_id then 0 else 1 end
  limit 1;

  if not found then
    raise exception 'thread_access_required' using errcode = '42501';
  end if;

  insert into messaging.messages(
    thread_id, sender_participant_id, sender_type, message_kind, body,
    approval_status, sent_at
  )
  values (
    p_thread_id,
    participant_record.id,
    participant_record.participant_type,
    'text',
    btrim(p_body),
    'sent',
    now()
  )
  returning * into message_record;

  update messaging.threads set updated_at = now() where id = p_thread_id;

  return jsonb_build_object(
    'id', message_record.id,
    'senderType', message_record.sender_type,
    'body', message_record.body,
    'kind', message_record.message_kind,
    'createdAt', message_record.created_at
  );
end;
$$;

create or replace function public.server_prepare_delivered_order_proof(
  target_order_id uuid,
  target_recipient_wallet_address text,
  target_order_hash text,
  target_snapshot_hash text,
  request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order commerce.orders%rowtype;
  proof commerce.order_proof_nfts%rowtype;
begin
  if target_order_id is null or request_key is null then
    raise exception 'ORDER_AND_REQUEST_KEY_REQUIRED';
  end if;
  if target_recipient_wallet_address !~ '^0x[0-9a-fA-F]{40}$' then
    raise exception 'INVALID_RECIPIENT_WALLET';
  end if;
  if target_order_hash !~ '^0x[0-9a-fA-F]{64}$'
    or target_snapshot_hash !~ '^0x[0-9a-fA-F]{64}$' then
    raise exception 'INVALID_PROOF_HASH';
  end if;

  select * into proof
  from commerce.order_proof_nfts
  where idempotency_key = request_key;
  if found then return to_jsonb(proof); end if;

  select * into target_order
  from commerce.orders
  where id = target_order_id
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  select * into proof
  from commerce.order_proof_nfts
  where order_id = target_order_id;
  if found then return to_jsonb(proof); end if;

  if target_order.status not in (
    'buyer_confirmed_received', 'proof_pending', 'proof_minted'
  ) or target_order.seller_marked_delivered_at is null
    or target_order.buyer_confirmed_received_at is null then
    raise exception 'DELIVERY_NOT_CONFIRMED';
  end if;

  if not exists (
    select 1
    from commerce.order_status_history delivered_event
    join commerce.order_status_history received_event
      on received_event.order_id = delivered_event.order_id
      and received_event.created_at >= delivered_event.created_at
    where delivered_event.order_id = target_order.id
      and delivered_event.to_status = 'seller_marked_delivered'
      and received_event.to_status = 'buyer_confirmed_received'
      and received_event.actor_type = 'buyer'
      and received_event.actor_id = target_order.buyer_id
  ) then
    raise exception 'DELIVERY_EVENTS_NOT_CONFIRMED';
  end if;

  if not exists (
    select 1
    from wallet.accounts wallet_account
    where wallet_account.user_id = target_order.buyer_id
      and wallet_account.chain_id = 5042002
      and wallet_account.is_primary
      and wallet_account.verified_at is not null
      and lower(wallet_account.address) = lower(target_recipient_wallet_address)
  ) then
    raise exception 'BUYER_WALLET_NOT_VERIFIED';
  end if;

  insert into commerce.order_proof_nfts(
    order_id, owner_user_id, recipient_wallet_address, order_hash,
    snapshot_hash, idempotency_key
  )
  values (
    target_order.id, target_order.buyer_id,
    lower(target_recipient_wallet_address), lower(target_order_hash),
    lower(target_snapshot_hash), request_key
  )
  returning * into proof;

  update commerce.orders
  set status = 'proof_pending', updated_at = now()
  where id = target_order.id
    and status = 'buyer_confirmed_received';

  return to_jsonb(proof);
end;
$$;

create or replace function public.server_confirm_order_proof(
  target_proof_id uuid,
  target_token_id numeric,
  target_transaction_hash text,
  target_block_number bigint,
  target_metadata_uri text,
  target_log_index integer,
  target_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  proof commerce.order_proof_nfts%rowtype;
  previous_order_status text;
begin
  if target_token_id is null or target_token_id <= 0 then
    raise exception 'INVALID_TOKEN_ID';
  end if;
  if target_transaction_hash !~ '^0x[0-9a-fA-F]{64}$'
    or target_payload_hash !~ '^0x[0-9a-fA-F]{64}$'
    or target_block_number is null or target_block_number < 0
    or target_log_index is null or target_log_index < 0 then
    raise exception 'INVALID_MINT_EVENT';
  end if;

  select * into proof
  from commerce.order_proof_nfts
  where id = target_proof_id
  for update;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;

  if proof.mint_status = 'confirmed'
    and proof.token_id = target_token_id
    and lower(proof.mint_transaction_hash) = lower(target_transaction_hash) then
    return to_jsonb(proof);
  end if;
  if proof.mint_status != 'submitted'
    or lower(proof.mint_transaction_hash) != lower(target_transaction_hash) then
    raise exception 'INVALID_PROOF_STATE';
  end if;

  insert into commerce.order_proof_nft_events(
    order_proof_nft_id, contract_address, transaction_hash, log_index,
    block_number, event_name, payload_hash
  )
  values (
    proof.id, proof.contract_address, lower(target_transaction_hash),
    target_log_index, target_block_number, 'OrderProofMinted',
    lower(target_payload_hash)
  )
  on conflict (chain_id, transaction_hash, log_index) do nothing;

  update commerce.order_proof_nfts
  set
    token_id = target_token_id,
    mint_status = 'confirmed',
    block_number = target_block_number,
    metadata_uri = target_metadata_uri,
    failure_code = null,
    confirmed_at = now(),
    updated_at = now()
  where id = target_proof_id
  returning * into proof;

  update commerce.order_proof_nft_attempts
  set status = 'confirmed', failure_code = null, finished_at = now()
  where order_proof_nft_id = proof.id
    and lower(transaction_hash) = lower(target_transaction_hash);

  select status into previous_order_status
  from commerce.orders
  where id = proof.order_id
  for update;

  if previous_order_status <> 'proof_minted' then
    update commerce.orders
    set status = 'proof_minted', updated_at = now()
    where id = proof.order_id;

    insert into commerce.order_status_history(
      order_id, from_status, to_status, actor_type, actor_id, reason,
      correlation_id
    )
    values (
      proof.order_id, previous_order_status, 'proof_minted', 'system', null,
      'Arc Testnet proof confirmed after buyer-confirmed demo delivery',
      proof.id
    );
  end if;

  return to_jsonb(proof);
end;
$$;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.update_my_profile(text, text, text, text, text)
  from public, anon;
revoke all on function public.sync_my_web3_wallet(text) from public, anon;
revoke all on function public.list_claimable_demo_makers() from public, anon;
revoke all on function public.claim_demo_maker(bigint) from public, anon;
revoke all on function public.get_my_commerce_workspace() from public, anon;
revoke all on function public.transition_quote_request(uuid, text, text, uuid)
  from public, anon;
revoke all on function public.transition_demo_order(uuid, text, text, uuid)
  from public, anon;
revoke all on function public.list_thread_messages(uuid) from public, anon;
revoke all on function public.send_thread_message(uuid, text) from public, anon;
revoke all on function public.server_prepare_delivered_order_proof(
  uuid, text, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_my_profile(text, text, text, text, text)
  to authenticated;
grant execute on function public.sync_my_web3_wallet(text) to authenticated;
grant execute on function public.list_claimable_demo_makers() to authenticated;
grant execute on function public.claim_demo_maker(bigint) to authenticated;
grant execute on function public.get_my_commerce_workspace() to authenticated;
grant execute on function public.transition_quote_request(uuid, text, text, uuid)
  to authenticated;
grant execute on function public.transition_demo_order(uuid, text, text, uuid)
  to authenticated;
grant execute on function public.list_thread_messages(uuid) to authenticated;
grant execute on function public.send_thread_message(uuid, text) to authenticated;
grant execute on function public.server_prepare_delivered_order_proof(
  uuid, text, text, text, uuid
) to service_role;

