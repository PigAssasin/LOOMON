-- Read-only escrow context for the single demo seller wallet.

create or replace function public.get_single_demo_seller_escrow_context(
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
begin
  if lower(p_wallet_address) <> '0xd59aa8db407d4219fe4b104ca4142df14301dec4' then
    raise exception 'demo_seller_wallet_required' using errcode = '42501';
  end if;

  select orders.* into order_record
  from commerce.orders orders
  join catalog.makers maker on maker.id = orders.maker_id
  where orders.id = p_order_id
    and maker.slug = 'lo-may';
  if not found then raise exception 'order_not_found'; end if;

  select * into escrow_record
  from payments.escrow_instances
  where order_id = order_record.id;
  if not found then raise exception 'escrow_not_found'; end if;

  return jsonb_build_object(
    'orderId', order_record.id,
    'orderReference', order_record.order_number,
    'status', order_record.status,
    'role', 'seller',
    'poolAddress', escrow_record.escrow_address,
    'onchainOrderId', escrow_record.onchain_order_id,
    'buyerAddress', escrow_record.buyer_address,
    'sellerAddress', escrow_record.merchant_address,
    'amountAtomic', escrow_record.amount_atomic::text,
    'sellerClaimableAt', escrow_record.seller_claimable_at
  );
end;
$$;

revoke all on function public.get_single_demo_seller_escrow_context(text, uuid)
from public, anon, authenticated;
grant execute on function public.get_single_demo_seller_escrow_context(text, uuid)
to service_role;
