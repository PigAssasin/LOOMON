-- Allow one delivered-order proof for each participant instead of one proof per order.
-- Buyer and seller receive separate non-transferable NFTs that point back to the
-- same LOOMON order through role-specific order hashes.

alter table commerce.order_proof_nfts
  drop constraint if exists order_proof_nfts_order_id_key;

create unique index if not exists order_proof_nfts_order_owner_idx
  on commerce.order_proof_nfts(order_id, owner_user_id);

create or replace function public.server_prepare_participant_order_proof(
  target_order_id uuid,
  target_owner_user_id uuid,
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
  if target_order_id is null or target_owner_user_id is null or request_key is null then
    raise exception 'ORDER_OWNER_AND_REQUEST_KEY_REQUIRED';
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
  where order_id = target_order_id
    and owner_user_id = target_owner_user_id;
  if found then return to_jsonb(proof); end if;

  select * into proof
  from commerce.order_proof_nfts
  where order_hash = lower(target_order_hash);
  if found then return to_jsonb(proof); end if;

  if target_order.status not in ('seller_marked_delivered', 'release_hold', 'released')
    or target_order.seller_marked_delivered_at is null then
    raise exception 'DELIVERY_NOT_MARKED';
  end if;

  if not exists (
    select 1
    from wallet.accounts wallet_account
    where wallet_account.user_id = target_owner_user_id
      and wallet_account.chain_id = 5042002
      and wallet_account.is_primary
      and wallet_account.verified_at is not null
      and lower(wallet_account.address) = lower(target_recipient_wallet_address)
  ) then
    raise exception 'OWNER_WALLET_NOT_VERIFIED';
  end if;

  insert into commerce.order_proof_nfts(
    order_id, owner_user_id, recipient_wallet_address, order_hash,
    snapshot_hash, idempotency_key
  )
  values (
    target_order.id, target_owner_user_id,
    lower(target_recipient_wallet_address), lower(target_order_hash),
    lower(target_snapshot_hash), request_key
  )
  returning * into proof;

  return to_jsonb(proof);
end;
$$;

create or replace function public.server_get_order_participant_proof_context(
  target_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_payload jsonb;
  buyer_wallet jsonb;
  seller_payload jsonb;
  seller_wallet jsonb;
begin
  select jsonb_build_object(
    'id', order_row.id,
    'order_number', order_row.order_number,
    'buyer_id', order_row.buyer_id,
    'maker_id', order_row.maker_id,
    'accepted_quote_version_id', order_row.accepted_quote_version_id,
    'deposit_invoice_id', order_row.deposit_invoice_id,
    'status', order_row.status
  )
  into order_payload
  from commerce.orders order_row
  where order_row.id = target_order_id;

  if order_payload is null then
    return null;
  end if;

  select jsonb_build_object('user_id', wallet_account.user_id, 'address', wallet_account.address)
  into buyer_wallet
  from wallet.accounts wallet_account
  where wallet_account.user_id = (order_payload ->> 'buyer_id')::uuid
    and wallet_account.chain_id = 5042002
    and wallet_account.is_primary
    and wallet_account.verified_at is not null
  order by wallet_account.verified_at desc
  limit 1;

  select jsonb_build_object('user_id', membership.user_id)
  into seller_payload
  from catalog.maker_memberships membership
  where membership.maker_id = (order_payload ->> 'maker_id')::bigint
    and membership.status = 'active'
    and membership.role in ('owner', 'manager', 'order_manager')
  order by
    case membership.role when 'owner' then 1 when 'manager' then 2 else 3 end,
    membership.created_at
  limit 1;

  if seller_payload is null then
    select jsonb_build_object('user_id', wallet_account.user_id)
    into seller_payload
    from wallet.accounts wallet_account
    where lower(wallet_account.address) = '0xd59aa8db407d4219fe4b104ca4142df14301dec4'
      and wallet_account.chain_id = 5042002
      and wallet_account.verified_at is not null
    order by wallet_account.verified_at desc
    limit 1;
  end if;

  if seller_payload is not null then
    select jsonb_build_object('user_id', wallet_account.user_id, 'address', wallet_account.address)
    into seller_wallet
    from wallet.accounts wallet_account
    where wallet_account.user_id = (seller_payload ->> 'user_id')::uuid
      and wallet_account.chain_id = 5042002
      and wallet_account.is_primary
      and wallet_account.verified_at is not null
    order by wallet_account.verified_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'order', order_payload,
    'buyerWallet', buyer_wallet,
    'sellerWallet', seller_wallet
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
  where order_id = target_order_id
    and owner_user_id = target_order.buyer_id;
  if found then return to_jsonb(proof); end if;

  select * into proof
  from commerce.order_proof_nfts
  where order_hash = lower(target_order_hash);
  if found then return to_jsonb(proof); end if;

  if target_order.status not in ('seller_marked_delivered', 'release_hold', 'released')
    or target_order.seller_marked_delivered_at is null then
    raise exception 'DELIVERY_NOT_MARKED';
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

revoke all on function public.server_prepare_participant_order_proof(
  uuid, uuid, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.server_prepare_participant_order_proof(
  uuid, uuid, text, text, text, uuid
) to service_role;

revoke all on function public.server_get_order_participant_proof_context(uuid)
from public, anon, authenticated;
grant execute on function public.server_get_order_participant_proof_context(uuid)
to service_role;

revoke all on function public.server_prepare_delivered_order_proof(
  uuid, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.server_prepare_delivered_order_proof(
  uuid, text, text, text, uuid
) to service_role;
