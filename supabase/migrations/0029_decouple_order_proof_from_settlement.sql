-- Keep the collectible proof lifecycle independent from the financial order lifecycle.
-- A proof is minted after buyer-confirmed completion, while the order remains in the
-- seven-day release hold until the seller claims the pooled USDC.

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

  if target_order.status not in ('release_hold', 'released')
    or target_order.seller_marked_delivered_at is null
    or target_order.buyer_confirmed_received_at is null then
    raise exception 'DELIVERY_NOT_CONFIRMED';
  end if;

  if not exists (
    select 1
    from commerce.order_status_history delivered_event
    join commerce.order_status_history completed_event
      on completed_event.order_id = delivered_event.order_id
      and completed_event.created_at >= delivered_event.created_at
    where delivered_event.order_id = target_order.id
      and delivered_event.to_status = 'seller_marked_delivered'
      and completed_event.to_status = 'release_hold'
      and completed_event.actor_type = 'buyer'
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

  return to_jsonb(proof);
end;
$$;

revoke all on function public.server_prepare_delivered_order_proof(
  uuid, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.server_prepare_delivered_order_proof(
  uuid, text, text, text, uuid
) to service_role;

revoke all on function public.server_confirm_order_proof(
  uuid, numeric, text, bigint, text, integer, text
) from public, anon, authenticated;
grant execute on function public.server_confirm_order_proof(
  uuid, numeric, text, bigint, text, integer, text
) to service_role;
