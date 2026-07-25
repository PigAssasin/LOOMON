create table commerce.order_proof_nfts (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null unique references commerce.orders(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  recipient_wallet_address text not null
    check (recipient_wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  chain_id bigint not null default 5042002 check (chain_id = 5042002),
  contract_address text
    check (contract_address is null or contract_address ~ '^0x[0-9a-fA-F]{40}$'),
  token_id numeric(78,0) check (token_id is null or token_id > 0),
  order_hash text not null unique check (order_hash ~ '^0x[0-9a-fA-F]{64}$'),
  snapshot_hash text not null check (snapshot_hash ~ '^0x[0-9a-fA-F]{64}$'),
  mint_status text not null default 'pending'
    check (mint_status in ('pending', 'submitted', 'confirmed', 'failed')),
  mint_transaction_hash text unique
    check (
      mint_transaction_hash is null
      or mint_transaction_hash ~ '^0x[0-9a-fA-F]{64}$'
    ),
  block_number bigint check (block_number is null or block_number >= 0),
  metadata_uri text,
  failure_code text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  idempotency_key uuid not null unique,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (mint_status = 'pending' and mint_transaction_hash is null and confirmed_at is null)
    or (
      mint_status = 'submitted'
      and contract_address is not null
      and mint_transaction_hash is not null
      and submitted_at is not null
      and confirmed_at is null
    )
    or (
      mint_status = 'confirmed'
      and contract_address is not null
      and token_id is not null
      and mint_transaction_hash is not null
      and block_number is not null
      and submitted_at is not null
      and confirmed_at is not null
    )
    or mint_status = 'failed'
  )
);

create index order_proof_nfts_owner_idx
  on commerce.order_proof_nfts(owner_user_id, created_at desc);
create index order_proof_nfts_pending_idx
  on commerce.order_proof_nfts(created_at, id)
  where mint_status in ('pending', 'failed');
create unique index order_proof_nfts_contract_token_idx
  on commerce.order_proof_nfts(chain_id, lower(contract_address), token_id)
  where contract_address is not null and token_id is not null;

create table commerce.order_proof_nft_events (
  id bigint generated always as identity primary key,
  order_proof_nft_id uuid not null
    references commerce.order_proof_nfts(id) on delete restrict,
  chain_id bigint not null default 5042002 check (chain_id = 5042002),
  contract_address text not null
    check (contract_address ~ '^0x[0-9a-fA-F]{40}$'),
  transaction_hash text not null
    check (transaction_hash ~ '^0x[0-9a-fA-F]{64}$'),
  log_index integer not null check (log_index >= 0),
  block_number bigint not null check (block_number >= 0),
  event_name text not null check (event_name = 'OrderProofMinted'),
  payload_hash text not null check (payload_hash ~ '^0x[0-9a-fA-F]{64}$'),
  observed_at timestamptz not null default now(),
  unique (chain_id, transaction_hash, log_index)
);

create index order_proof_nft_events_proof_idx
  on commerce.order_proof_nft_events(order_proof_nft_id, observed_at desc);

create table commerce.order_proof_nft_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  order_proof_nft_id uuid not null
    references commerce.order_proof_nfts(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  chain_id bigint not null default 5042002 check (chain_id = 5042002),
  contract_address text not null
    check (contract_address ~ '^0x[0-9a-fA-F]{40}$'),
  transaction_hash text not null unique
    check (transaction_hash ~ '^0x[0-9a-fA-F]{64}$'),
  status text not null default 'submitted'
    check (status in ('submitted', 'confirmed', 'failed')),
  failure_code text,
  submitted_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (order_proof_nft_id, attempt_number)
);

create index order_proof_nft_attempts_proof_idx
  on commerce.order_proof_nft_attempts(order_proof_nft_id, attempt_number desc);

alter table commerce.order_proof_nfts enable row level security;
alter table commerce.order_proof_nft_events enable row level security;
alter table commerce.order_proof_nft_attempts enable row level security;

create policy order_proof_nfts_participant_select
on commerce.order_proof_nfts
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or exists (
    select 1
    from commerce.orders target_order
    where target_order.id = order_id
      and catalog.has_maker_role(target_order.maker_id)
  )
);

create policy order_proof_nft_events_participant_select
on commerce.order_proof_nft_events
for select
to authenticated
using (
  exists (
    select 1
    from commerce.order_proof_nfts proof
    where proof.id = order_proof_nft_id
      and (
        proof.owner_user_id = (select auth.uid())
        or exists (
          select 1
          from commerce.orders target_order
          where target_order.id = proof.order_id
            and catalog.has_maker_role(target_order.maker_id)
        )
      )
  )
);

create policy order_proof_nft_attempts_participant_select
on commerce.order_proof_nft_attempts
for select
to authenticated
using (
  exists (
    select 1
    from commerce.order_proof_nfts proof
    where proof.id = order_proof_nft_id
      and (
        proof.owner_user_id = (select auth.uid())
        or exists (
          select 1
          from commerce.orders target_order
          where target_order.id = proof.order_id
            and catalog.has_maker_role(target_order.maker_id)
        )
      )
  )
);

grant select on
  commerce.order_proof_nfts,
  commerce.order_proof_nft_events,
  commerce.order_proof_nft_attempts
to authenticated;
grant usage, select on sequence commerce.order_proof_nft_events_id_seq
to service_role;

create or replace function public.server_prepare_order_proof(
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
  if found then
    return to_jsonb(proof);
  end if;

  select * into target_order
  from commerce.orders
  where id = target_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  select * into proof
  from commerce.order_proof_nfts
  where order_id = target_order_id;
  if found then return to_jsonb(proof); end if;

  if target_order.status not in ('deposit_paid', 'completed') then
    raise exception 'ORDER_PAYMENT_NOT_READY';
  end if;

  if not exists (
    select 1
    from commerce.invoices invoice
    join payments.payment_intents intent on intent.invoice_id = invoice.id
    join payments.transactions transaction_record
      on transaction_record.payment_intent_id = intent.id
    where invoice.id = target_order.deposit_invoice_id
      and invoice.status = 'paid'
      and invoice.chain_id = 5042002
      and intent.status = 'confirmed'
      and transaction_record.chain_id = 5042002
      and transaction_record.receipt_status = 'success'
      and transaction_record.amount_atomic >= invoice.amount_atomic
  ) then
    raise exception 'PAYMENT_NOT_VERIFIED';
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
    order_id,
    owner_user_id,
    recipient_wallet_address,
    order_hash,
    snapshot_hash,
    idempotency_key
  )
  values (
    target_order.id,
    target_order.buyer_id,
    lower(target_recipient_wallet_address),
    lower(target_order_hash),
    lower(target_snapshot_hash),
    request_key
  )
  returning * into proof;

  return to_jsonb(proof);
end;
$$;

create or replace function public.server_mark_order_proof_submitted(
  target_proof_id uuid,
  target_contract_address text,
  target_transaction_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  proof commerce.order_proof_nfts%rowtype;
begin
  if target_contract_address !~ '^0x[0-9a-fA-F]{40}$'
    or target_transaction_hash !~ '^0x[0-9a-fA-F]{64}$' then
    raise exception 'INVALID_CHAIN_REFERENCE';
  end if;

  select * into proof
  from commerce.order_proof_nfts
  where id = target_proof_id
  for update;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;

  if proof.mint_status in ('submitted', 'confirmed')
    and lower(proof.mint_transaction_hash) = lower(target_transaction_hash) then
    return to_jsonb(proof);
  end if;
  if proof.mint_status not in ('pending', 'failed') then
    raise exception 'INVALID_PROOF_STATE';
  end if;

  update commerce.order_proof_nfts
  set
    contract_address = lower(target_contract_address),
    mint_transaction_hash = lower(target_transaction_hash),
    mint_status = 'submitted',
    failure_code = null,
    attempt_count = attempt_count + 1,
    submitted_at = now(),
    confirmed_at = null,
    updated_at = now()
  where id = target_proof_id
  returning * into proof;

  insert into commerce.order_proof_nft_attempts(
    order_proof_nft_id,
    attempt_number,
    contract_address,
    transaction_hash
  )
  values (
    proof.id,
    proof.attempt_count,
    proof.contract_address,
    proof.mint_transaction_hash
  )
  on conflict (transaction_hash) do nothing;

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
    order_proof_nft_id,
    contract_address,
    transaction_hash,
    log_index,
    block_number,
    event_name,
    payload_hash
  )
  values (
    proof.id,
    proof.contract_address,
    lower(target_transaction_hash),
    target_log_index,
    target_block_number,
    'OrderProofMinted',
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

  if previous_order_status != 'completed' then
    update commerce.orders
    set status = 'completed', updated_at = now()
    where id = proof.order_id;

    insert into commerce.order_status_history(
      order_id,
      from_status,
      to_status,
      actor_type,
      actor_id,
      reason,
      correlation_id
    )
    values (
      proof.order_id,
      previous_order_status,
      'completed',
      'system',
      null,
      'Arc Testnet Order Proof NFT confirmed; demo only, no physical delivery',
      proof.id
    );
  end if;

  return to_jsonb(proof);
end;
$$;

create or replace function public.server_fail_order_proof(
  target_proof_id uuid,
  target_failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  proof commerce.order_proof_nfts%rowtype;
begin
  if target_failure_code is null or btrim(target_failure_code) = '' then
    raise exception 'FAILURE_CODE_REQUIRED';
  end if;

  update commerce.order_proof_nfts
  set
    mint_status = 'failed',
    failure_code = left(target_failure_code, 120),
    updated_at = now()
  where id = target_proof_id
    and mint_status in ('pending', 'submitted', 'failed')
  returning * into proof;

  if not found then raise exception 'PROOF_NOT_FOUND_OR_FINAL'; end if;

  update commerce.order_proof_nft_attempts
  set
    status = 'failed',
    failure_code = proof.failure_code,
    finished_at = now()
  where order_proof_nft_id = proof.id
    and transaction_hash = proof.mint_transaction_hash
    and status = 'submitted';

  return to_jsonb(proof);
end;
$$;

revoke execute on function public.server_prepare_order_proof(
  uuid, text, text, text, uuid
) from public, anon, authenticated;
revoke execute on function public.server_mark_order_proof_submitted(
  uuid, text, text
) from public, anon, authenticated;
revoke execute on function public.server_confirm_order_proof(
  uuid, numeric, text, bigint, text, integer, text
) from public, anon, authenticated;
revoke execute on function public.server_fail_order_proof(
  uuid, text
) from public, anon, authenticated;

grant execute on function public.server_prepare_order_proof(
  uuid, text, text, text, uuid
) to service_role;
grant execute on function public.server_mark_order_proof_submitted(
  uuid, text, text
) to service_role;
grant execute on function public.server_confirm_order_proof(
  uuid, numeric, text, bigint, text, integer, text
) to service_role;
grant execute on function public.server_fail_order_proof(
  uuid, text
) to service_role;
