-- Keep commerce tables unexposed. The receipt verifier gets only the immutable
-- fields needed to validate one checkout through this service-role-only RPC.

create or replace function public.server_get_prepaid_checkout(p_checkout_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  checkout_record commerce.checkout_sessions%rowtype;
begin
  select * into checkout_record
  from commerce.checkout_sessions
  where id = p_checkout_id;
  if not found then raise exception 'checkout_not_found'; end if;

  return jsonb_build_object(
    'id', checkout_record.id,
    'buyer_id', checkout_record.buyer_id,
    'onchain_order_id', checkout_record.onchain_order_id,
    'terms_hash', checkout_record.terms_hash,
    'buyer_address', checkout_record.buyer_address,
    'seller_address', checkout_record.seller_address,
    'pool_address', checkout_record.pool_address,
    'amount_atomic', checkout_record.amount_atomic::text
  );
end;
$$;

revoke all on function public.server_get_prepaid_checkout(uuid)
  from public, anon, authenticated;
grant execute on function public.server_get_prepaid_checkout(uuid)
  to service_role;
