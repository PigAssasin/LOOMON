-- Direct buyer-funded Arc escrow checkout.
-- The chain is authoritative for funding; canonical orders are created only
-- after the server verifies LoomonEscrowPool.OrderFunded.

create table payments.maker_payout_destinations (
  id uuid primary key default extensions.gen_random_uuid(),
  maker_id bigint not null references catalog.makers(id) on delete cascade,
  wallet_account_id uuid not null references wallet.accounts(id) on delete restrict,
  chain_id bigint not null default 5042002 check (chain_id = 5042002),
  activated_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (maker_id, wallet_account_id)
);

create unique index maker_one_active_payout_idx
  on payments.maker_payout_destinations(maker_id)
  where revoked_at is null;

create index maker_payout_wallet_idx
  on payments.maker_payout_destinations(wallet_account_id)
  where revoked_at is null;

insert into payments.maker_payout_destinations(
  maker_id, wallet_account_id, created_by_user_id
)
select distinct on (membership.maker_id)
  membership.maker_id,
  account.id,
  membership.user_id
from catalog.maker_memberships membership
join wallet.accounts account
  on account.user_id = membership.user_id
  and account.chain_id = 5042002
  and account.is_primary
  and account.verified_at is not null
where membership.status = 'active'
  and membership.role in ('owner', 'manager')
order by membership.maker_id, membership.role = 'owner' desc, account.created_at
on conflict do nothing;

create table commerce.checkout_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  quote_request_id uuid not null references commerce.quote_requests(id) on delete restrict,
  quote_version_id uuid not null references commerce.quote_versions(id) on delete restrict,
  invoice_id uuid not null references commerce.invoices(id) on delete restrict,
  project_id uuid not null references customization.projects(id) on delete restrict,
  brief_id uuid not null references customization.briefs(id) on delete restrict,
  product_id bigint not null references catalog.products(id) on delete restrict,
  product_version_id bigint not null references catalog.product_versions(id) on delete restrict,
  maker_id bigint not null references catalog.makers(id) on delete restrict,
  payout_destination_id uuid not null
    references payments.maker_payout_destinations(id) on delete restrict,
  contract_version_id uuid not null
    references payments.contract_versions(id) on delete restrict,
  client_request_key uuid not null,
  onchain_order_id text not null unique
    check (onchain_order_id ~ '^0x[0-9a-f]{64}$'),
  terms_hash text not null check (terms_hash ~ '^0x[0-9a-f]{64}$'),
  quantity integer not null check (quantity > 0),
  required_by date,
  currency_code text not null default 'USDC' check (currency_code = 'USDC'),
  token_decimals smallint not null default 6 check (token_decimals = 6),
  unit_amount numeric(20,6) not null check (unit_amount > 0),
  amount numeric(20,6) not null check (amount > 0),
  amount_atomic bigint not null check (amount_atomic > 0),
  buyer_address text not null check (buyer_address ~ '^0x[0-9a-f]{40}$'),
  seller_address text not null check (seller_address ~ '^0x[0-9a-f]{40}$'),
  pool_address text not null check (pool_address ~ '^0x[0-9a-f]{40}$'),
  status text not null default 'prepared'
    check (status in (
      'prepared', 'approval_pending', 'submitted', 'confirmed',
      'failed', 'expired', 'cancelled'
    )),
  transaction_hash text check (
    transaction_hash is null or transaction_hash ~ '^0x[0-9a-f]{64}$'
  ),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, client_request_key)
);

create index checkout_buyer_status_idx
  on commerce.checkout_sessions(buyer_id, status, created_at desc);
create index checkout_maker_status_idx
  on commerce.checkout_sessions(maker_id, status, created_at desc);
create index checkout_expiry_idx
  on commerce.checkout_sessions(expires_at)
  where status in ('prepared', 'approval_pending', 'submitted');

alter table payments.payment_intents
  add column checkout_session_id uuid
    references commerce.checkout_sessions(id) on delete restrict,
  add column contract_version_id uuid
    references payments.contract_versions(id) on delete restrict;

create unique index payment_intents_checkout_idx
  on payments.payment_intents(checkout_session_id)
  where checkout_session_id is not null;

alter table payments.escrow_instances
  add column onchain_order_id text,
  add column funded_transaction_hash text,
  add column funded_at timestamptz,
  add column completed_at timestamptz,
  add column seller_claimable_at timestamptz,
  add column released_at timestamptz;

alter table payments.escrow_instances
  drop constraint if exists escrow_instances_escrow_address_key;

create index if not exists escrow_instances_pool_address_idx
  on payments.escrow_instances(escrow_address, updated_at desc);

alter table payments.escrow_instances
  add constraint escrow_onchain_order_id_format
  check (onchain_order_id is null or onchain_order_id ~ '^0x[0-9a-f]{64}$'),
  add constraint escrow_funded_transaction_hash_format
  check (
    funded_transaction_hash is null
    or funded_transaction_hash ~ '^0x[0-9a-f]{64}$'
  );

create unique index escrow_onchain_order_id_idx
  on payments.escrow_instances(onchain_order_id)
  where onchain_order_id is not null;

alter table payments.escrow_instances
  drop constraint if exists escrow_instances_status_check;
alter table payments.escrow_instances
  add constraint escrow_instances_status_check
  check (status in (
    'created', 'funded', 'in_production', 'delivered', 'release_hold',
    'released', 'cancelled', 'refunded', 'disputed', 'resolved'
  ));

alter table commerce.orders
  drop constraint if exists orders_status_check;
alter table commerce.orders
  add constraint orders_status_check
  check (status in (
    'deposit_pending', 'deposit_paid', 'production_confirmed',
    'design_approval_pending', 'in_production', 'ready', 'completed',
    'seller_accepted', 'in_progress', 'seller_marked_delivered',
    'delivery_disputed', 'buyer_confirmed_received', 'proof_pending',
    'proof_minted', 'cancelled',
    'escrow_funded', 'release_hold', 'released', 'refunded', 'disputed',
    'resolved'
  ));

alter table commerce.checkout_sessions enable row level security;
alter table payments.maker_payout_destinations enable row level security;

create policy checkout_buyer_select
on commerce.checkout_sessions for select to authenticated
using (buyer_id = (select auth.uid()));

create policy checkout_maker_select
on commerce.checkout_sessions for select to authenticated
using (catalog.has_maker_role(maker_id));

create policy payout_maker_select
on payments.maker_payout_destinations for select to authenticated
using (catalog.has_maker_role(maker_id));

grant select on commerce.checkout_sessions to authenticated;
grant select on payments.maker_payout_destinations to authenticated;

update payments.contract_versions
set status = 'retired'
where chain_id = 5042002
  and contract_name = 'LoomonEscrowPool'
  and status = 'active';

insert into payments.contract_versions(
  chain_id, contract_name, version, implementation_address, bytecode_hash,
  deployment_tx_hash, deployment_block, status, activated_at
)
values (
  5042002,
  'LoomonEscrowPool',
  '1.0.0',
  '0x71c23bace617d0cdfd2f4dec31d81f5eb08216c7',
  '0xf248cd18f2e1a189cbd83c1e96107d58909e589efac5c6970f197eed1088819f',
  '0xc3d3d0ee8f246cabd89caa763a1bd84be9d91dc4352169ebb43404dd57125af6',
  53557800,
  'active',
  now()
)
on conflict (chain_id, contract_name, version) do update
set
  implementation_address = excluded.implementation_address,
  bytecode_hash = excluded.bytecode_hash,
  deployment_tx_hash = excluded.deployment_tx_hash,
  deployment_block = excluded.deployment_block,
  status = excluded.status,
  activated_at = excluded.activated_at;

create or replace function public.prepare_prepaid_checkout(
  p_quote_request_id uuid,
  p_buyer_address text,
  p_client_request_key uuid
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
  checkout_record commerce.checkout_sessions%rowtype;
  quote_record commerce.quote_versions%rowtype;
  invoice_record commerce.invoices%rowtype;
  payout_record payments.maker_payout_destinations%rowtype;
  payout_address text;
  contract_record payments.contract_versions%rowtype;
  unit_price numeric(20,6);
  total_price numeric(20,6);
  total_atomic bigint;
  checkout_id uuid := extensions.gen_random_uuid();
  order_key text;
  normalized_terms text;
  target_terms_hash text;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_client_request_key is null then
    raise exception 'request_key_required' using errcode = '22023';
  end if;
  if p_buyer_address !~ '^0x[0-9a-fA-F]{40}$' then
    raise exception 'invalid_buyer_address' using errcode = '22023';
  end if;

  select * into checkout_record
  from commerce.checkout_sessions
  where buyer_id = actor_id and client_request_key = p_client_request_key;
  if found then
    return jsonb_build_object(
      'checkoutId', checkout_record.id,
      'onchainOrderId', checkout_record.onchain_order_id,
      'termsHash', checkout_record.terms_hash,
      'buyerAddress', checkout_record.buyer_address,
      'sellerAddress', checkout_record.seller_address,
      'poolAddress', checkout_record.pool_address,
      'amountAtomic', checkout_record.amount_atomic::text,
      'amount', checkout_record.amount,
      'expiresAt', checkout_record.expires_at,
      'status', checkout_record.status,
      'idempotent', true
    );
  end if;

  select * into request_record
  from commerce.quote_requests
  where id = p_quote_request_id and buyer_id = actor_id
  for update;
  if not found then raise exception 'quote_request_not_found'; end if;
  if request_record.project_id is null or request_record.brief_id is null then
    raise exception 'customization_brief_required' using errcode = '22023';
  end if;

  select * into item_record
  from commerce.quote_request_items
  where quote_request_id = request_record.id
  order by id
  limit 1;
  if not found then raise exception 'quote_item_not_found'; end if;

  if not exists (
    select 1
    from catalog.products product
    join catalog.product_versions version
      on version.id = product.published_version_id
    join catalog.product_availability availability
      on availability.product_id = product.id
    where product.id = item_record.product_id
      and version.id = item_record.product_version_id
      and product.status = 'published'
      and version.workflow_status = 'published'
      and availability.status = 'available'
  ) then
    raise exception 'product_not_available';
  end if;

  select price.unit_amount into unit_price
  from catalog.price_rules price
  where price.product_version_id = item_record.product_version_id
    and price.currency_code = 'USDC'
    and price.minimum_quantity <= item_record.quantity
    and (price.maximum_quantity is null or price.maximum_quantity >= item_record.quantity)
    and price.valid_from <= now()
    and (price.valid_until is null or price.valid_until > now())
  order by price.minimum_quantity desc, price.id desc
  limit 1;
  if unit_price is null or unit_price <= 0 then
    raise exception 'authoritative_price_unavailable';
  end if;

  select destination.* into payout_record
  from payments.maker_payout_destinations destination
  join wallet.accounts account on account.id = destination.wallet_account_id
  where destination.maker_id = request_record.maker_id
    and destination.chain_id = 5042002
    and destination.revoked_at is null
    and account.chain_id = 5042002
    and account.verified_at is not null
  limit 1;
  if payout_record.id is null then
    raise exception 'seller_payment_setup_required';
  end if;

  select lower(account.address) into payout_address
  from wallet.accounts account
  where account.id = payout_record.wallet_account_id;

  select * into contract_record
  from payments.contract_versions version
  where version.chain_id = 5042002
    and version.contract_name = 'LoomonEscrowPool'
    and version.status = 'active'
    and version.implementation_address is not null
  order by version.activated_at desc, version.created_at desc
  limit 1;
  if contract_record.id is null then
    raise exception 'escrow_pool_not_configured';
  end if;

  total_price := unit_price * item_record.quantity;
  total_atomic := round(total_price * 1000000)::bigint;
  order_key := '0x' || encode(
    extensions.digest(checkout_id::text, 'sha256'), 'hex'
  );
  normalized_terms := concat_ws('|',
    checkout_id::text,
    actor_id::text,
    request_record.maker_id::text,
    item_record.product_version_id::text,
    request_record.brief_id::text,
    item_record.quantity::text,
    coalesce(request_record.required_by::text, ''),
    total_atomic::text,
    lower(p_buyer_address),
    payout_address,
    lower(contract_record.implementation_address)
  );
  target_terms_hash := '0x' || encode(
    extensions.digest(normalized_terms, 'sha256'), 'hex'
  );

  insert into commerce.quote_versions(
    quote_request_id, version_number, status, currency_code, subtotal,
    customization_total, total, deposit_percentage, snapshot, issued_at,
    expires_at
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
    100,
    jsonb_build_object(
      'unitPrice', unit_price,
      'quantity', item_record.quantity,
      'requiredBy', request_record.required_by,
      'prepaidEscrow', true,
      'termsHash', target_terms_hash
    ),
    now(),
    now() + interval '30 minutes'
  )
  returning * into quote_record;

  insert into commerce.invoices(
    invoice_number, quote_version_id, buyer_id, maker_id, invoice_type,
    currency_code, token_decimals, amount, amount_atomic, recipient_address,
    chain_id, status, expires_at, snapshot
  )
  values (
    'LM-IV-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10)),
    quote_record.id,
    actor_id,
    request_record.maker_id,
    'deposit',
    'USDC',
    6,
    total_price,
    total_atomic,
    lower(contract_record.implementation_address),
    5042002,
    'ready',
    now() + interval '30 minutes',
    jsonb_build_object(
      'checkoutId', checkout_id,
      'onchainOrderId', order_key,
      'sellerAddress', payout_address,
      'termsHash', target_terms_hash
    )
  )
  returning * into invoice_record;

  insert into commerce.checkout_sessions(
    id, buyer_id, quote_request_id, quote_version_id, invoice_id, project_id,
    brief_id, product_id, product_version_id, maker_id,
    payout_destination_id, contract_version_id, client_request_key,
    onchain_order_id, terms_hash, quantity, required_by, unit_amount, amount,
    amount_atomic, buyer_address, seller_address, pool_address, expires_at
  )
  values (
    checkout_id, actor_id, request_record.id, quote_record.id,
    invoice_record.id, request_record.project_id, request_record.brief_id,
    item_record.product_id, item_record.product_version_id,
    request_record.maker_id, payout_record.id, contract_record.id,
    p_client_request_key, order_key, target_terms_hash, item_record.quantity,
    request_record.required_by, unit_price, total_price, total_atomic,
    lower(p_buyer_address), payout_address,
    lower(contract_record.implementation_address), invoice_record.expires_at
  )
  returning * into checkout_record;

  insert into payments.payment_intents(
    invoice_id, checkout_session_id, contract_version_id, idempotency_key,
    status, prepared_payload
  )
  values (
    invoice_record.id, checkout_record.id, contract_record.id,
    'checkout:' || checkout_record.id::text,
    'approval_required',
    jsonb_build_object(
      'chainId', 5042002,
      'token', '0x3600000000000000000000000000000000000000',
      'pool', checkout_record.pool_address,
      'method', 'placeOrder',
      'orderId', checkout_record.onchain_order_id,
      'seller', checkout_record.seller_address,
      'amountAtomic', checkout_record.amount_atomic::text,
      'termsHash', checkout_record.terms_hash
    )
  );

  return jsonb_build_object(
    'checkoutId', checkout_record.id,
    'onchainOrderId', checkout_record.onchain_order_id,
    'termsHash', checkout_record.terms_hash,
    'buyerAddress', checkout_record.buyer_address,
    'sellerAddress', checkout_record.seller_address,
    'poolAddress', checkout_record.pool_address,
    'amountAtomic', checkout_record.amount_atomic::text,
    'amount', checkout_record.amount,
    'expiresAt', checkout_record.expires_at,
    'status', checkout_record.status,
    'idempotent', false
  );
end;
$$;

create or replace function public.server_confirm_prepaid_order(
  p_checkout_id uuid,
  p_transaction_hash text,
  p_block_number bigint,
  p_log_index integer,
  p_event_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout_record commerce.checkout_sessions%rowtype;
  existing_order commerce.orders%rowtype;
  created_order commerce.orders%rowtype;
  payment_intent_id uuid;
  target_thread_id uuid;
begin
  if p_checkout_id is null
    or p_transaction_hash !~ '^0x[0-9a-fA-F]{64}$'
    or p_block_number is null or p_block_number < 0
    or p_log_index is null or p_log_index < 0
  then
    raise exception 'invalid_verified_payment';
  end if;

  select * into checkout_record
  from commerce.checkout_sessions
  where id = p_checkout_id
  for update;
  if not found then raise exception 'checkout_not_found'; end if;

  select orders.* into existing_order
  from commerce.orders orders
  where orders.accepted_quote_version_id = checkout_record.quote_version_id;
  if found then
    return jsonb_build_object(
      'orderId', existing_order.id,
      'orderReference', existing_order.order_number,
      'checkoutId', checkout_record.id,
      'transactionHash', checkout_record.transaction_hash,
      'status', existing_order.status,
      'idempotent', true
    );
  end if;

  if checkout_record.status not in ('prepared', 'approval_pending', 'submitted') then
    raise exception 'checkout_not_confirmable';
  end if;
  if checkout_record.expires_at < now() then raise exception 'checkout_expired'; end if;

  select id into payment_intent_id
  from payments.payment_intents
  where checkout_session_id = checkout_record.id;

  insert into payments.transactions(
    payment_intent_id, chain_id, transaction_hash, sender_address,
    recipient_address, token_address, amount_atomic, receipt_status,
    block_number, confirmed_at, raw_receipt
  )
  values (
    payment_intent_id, 5042002, lower(p_transaction_hash),
    checkout_record.buyer_address, checkout_record.pool_address,
    '0x3600000000000000000000000000000000000000',
    checkout_record.amount_atomic, 'success', p_block_number, now(),
    jsonb_build_object('verifiedEvent', p_event_payload, 'logIndex', p_log_index)
  );

  insert into commerce.orders(
    order_number, buyer_id, maker_id, accepted_quote_version_id,
    deposit_invoice_id, status, client_request_key
  )
  values (
    'LM-' || to_char(now(), 'YY-MM-') ||
      upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6)),
    checkout_record.buyer_id, checkout_record.maker_id,
    checkout_record.quote_version_id, checkout_record.invoice_id,
    'escrow_funded', checkout_record.client_request_key
  )
  returning * into created_order;

  insert into payments.escrow_instances(
    order_id, contract_version_id, escrow_address, buyer_address,
    merchant_address, token_address, amount_atomic, terms_hash, status,
    onchain_order_id, funded_transaction_hash, funded_at
  )
  values (
    created_order.id, checkout_record.contract_version_id,
    checkout_record.pool_address, checkout_record.buyer_address,
    checkout_record.seller_address,
    '0x3600000000000000000000000000000000000000',
    checkout_record.amount_atomic, checkout_record.terms_hash, 'funded',
    checkout_record.onchain_order_id, lower(p_transaction_hash), now()
  );

  insert into payments.chain_events(
    chain_id, contract_address, transaction_hash, log_index, block_number,
    event_name, decoded_payload, projection_status, projected_at
  )
  values (
    5042002, checkout_record.pool_address, lower(p_transaction_hash),
    p_log_index, p_block_number, 'OrderFunded', p_event_payload,
    'projected', now()
  );

  insert into commerce.order_briefs(
    order_id, project_id, brief_id, selected_render_candidate_id, terms_hash
  )
  select created_order.id, checkout_record.project_id, checkout_record.brief_id,
    brief.selected_candidate_id, substring(checkout_record.terms_hash from 3)
  from customization.briefs brief
  where brief.id = checkout_record.brief_id;

  update commerce.checkout_sessions
  set status = 'confirmed', transaction_hash = lower(p_transaction_hash),
      submitted_at = coalesce(submitted_at, now()), confirmed_at = now(),
      updated_at = now()
  where id = checkout_record.id;

  update payments.payment_intents
  set status = 'confirmed', updated_at = now()
  where id = payment_intent_id;

  update commerce.invoices
  set status = 'paid', paid_at = now()
  where id = checkout_record.invoice_id;

  update commerce.quote_requests
  set status = 'accepted', decided_at = now(), updated_at = now()
  where id = checkout_record.quote_request_id;

  update customization.projects
  set status = 'ordered', updated_at = now()
  where id = checkout_record.project_id;

  update messaging.threads
  set order_id = created_order.id,
      title = 'Order ' || created_order.order_number,
      updated_at = now()
  where project_id = checkout_record.project_id
    and thread_type = 'buyer_seller'
  returning id into target_thread_id;

  insert into commerce.order_status_history(
    order_id, from_status, to_status, actor_type, actor_id, reason
  )
  values (
    created_order.id, null, 'escrow_funded', 'buyer',
    checkout_record.buyer_id, 'Arc escrow funding verified'
  );

  insert into messaging.messages(
    thread_id, sender_type, message_kind, structured_body,
    approval_status, sent_at
  )
  select target_thread_id, 'system', 'status_update',
    jsonb_build_object(
      'event', 'order_escrow_funded',
      'orderId', created_order.id,
      'transactionHash', lower(p_transaction_hash)
    ),
    'sent', now()
  where target_thread_id is not null;

  return jsonb_build_object(
    'orderId', created_order.id,
    'orderReference', created_order.order_number,
    'checkoutId', checkout_record.id,
    'transactionHash', lower(p_transaction_hash),
    'status', created_order.status,
    'idempotent', false
  );
end;
$$;

revoke all on function public.prepare_prepaid_checkout(uuid, text, uuid)
  from public, anon;
grant execute on function public.prepare_prepaid_checkout(uuid, text, uuid)
  to authenticated;

revoke all on function public.server_confirm_prepaid_order(
  uuid, text, bigint, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.server_confirm_prepaid_order(
  uuid, text, bigint, integer, jsonb
) to service_role;
