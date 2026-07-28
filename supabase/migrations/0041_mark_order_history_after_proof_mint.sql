-- In the demo flow, seller delivery mints proof NFTs immediately. Once any
-- participant proof is confirmed, the order can move to the compact History
-- bucket as proof_minted. Escrow settlement remains represented by verified
-- chain events; this status is a demo-delivery/proof status, not a seller payout.

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

  if previous_order_status in ('seller_marked_delivered', 'proof_pending') then
    update commerce.orders
    set status = 'proof_minted', updated_at = now()
    where id = proof.order_id;

    insert into commerce.order_status_history(
      order_id, from_status, to_status, actor_type, actor_id, reason,
      correlation_id
    )
    values (
      proof.order_id, previous_order_status, 'proof_minted', 'system', null,
      'Arc Testnet delivery proof NFT confirmed; escrow funds remain governed by the pool contract.',
      proof.id
    );
  end if;

  return to_jsonb(proof);
end;
$$;

revoke all on function public.server_confirm_order_proof(
  uuid, numeric, text, bigint, text, integer, text
) from public, anon, authenticated;
grant execute on function public.server_confirm_order_proof(
  uuid, numeric, text, bigint, text, integer, text
) to service_role;
