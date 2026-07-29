-- Align LOOMON order flow with onchain escrow state:
-- funded = awaiting seller decision, in_production = seller accepted.

create or replace function public.get_wallet_order_escrow_context(
  p_wallet_address text,
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  order_record commerce.orders%rowtype;
  escrow_record payments.escrow_instances%rowtype;
  normalized_wallet text := lower(p_wallet_address);
  actor_role text;
begin
  if p_wallet_address !~ '^0x[0-9a-fA-F]{40}$' then
    raise exception 'invalid_wallet_address' using errcode = '22023';
  end if;

  select * into order_record
  from commerce.orders
  where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;

  select * into escrow_record
  from payments.escrow_instances
  where order_id = order_record.id;
  if not found then raise exception 'escrow_not_found'; end if;

  if lower(escrow_record.buyer_address) = normalized_wallet then
    actor_role := 'buyer';
  elsif lower(escrow_record.merchant_address) = normalized_wallet then
    actor_role := 'seller';
  else
    raise exception 'wallet_order_access_required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'orderId', order_record.id,
    'orderReference', order_record.order_number,
    'status', order_record.status,
    'role', actor_role,
    'poolAddress', escrow_record.escrow_address,
    'onchainOrderId', escrow_record.onchain_order_id,
    'buyerAddress', escrow_record.buyer_address,
    'sellerAddress', escrow_record.merchant_address,
    'amountAtomic', escrow_record.amount_atomic::text,
    'sellerClaimableAt', escrow_record.seller_claimable_at
  );
end;
$$;

revoke all on function public.get_wallet_order_escrow_context(text, uuid)
from public, anon, authenticated;
grant execute on function public.get_wallet_order_escrow_context(text, uuid)
to service_role;

create or replace function public.get_order_escrow_context_for_projection(
  p_order_id uuid,
  p_role text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  order_record commerce.orders%rowtype;
  escrow_record payments.escrow_instances%rowtype;
begin
  if p_role not in ('buyer', 'seller') then
    raise exception 'invalid_projection_role';
  end if;

  select * into order_record
  from commerce.orders
  where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;

  select * into escrow_record
  from payments.escrow_instances
  where order_id = order_record.id;
  if not found then raise exception 'escrow_not_found'; end if;

  return jsonb_build_object(
    'orderId', order_record.id,
    'orderReference', order_record.order_number,
    'status', order_record.status,
    'role', p_role,
    'poolAddress', escrow_record.escrow_address,
    'onchainOrderId', escrow_record.onchain_order_id,
    'buyerAddress', escrow_record.buyer_address,
    'sellerAddress', escrow_record.merchant_address,
    'amountAtomic', escrow_record.amount_atomic::text,
    'sellerClaimableAt', escrow_record.seller_claimable_at
  );
end;
$$;

revoke all on function public.get_order_escrow_context_for_projection(uuid, text)
from public, anon, authenticated;
grant execute on function public.get_order_escrow_context_for_projection(uuid, text)
to service_role;
