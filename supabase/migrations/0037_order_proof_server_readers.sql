-- Keep proof/order/wallet tables in private schemas while giving server routes
-- narrow service-role readers for Purchased and proof mint orchestration.

create or replace function public.server_list_purchased_order_proofs(
  target_owner_user_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      to_jsonb(proof_row)
      || jsonb_build_object(
        'order_number',
        coalesce(order_row.order_number, 'LOOMON demo order')
      )
      order by proof_row.created_at desc
    ),
    '[]'::jsonb
  )
  from commerce.order_proof_nfts proof_row
  left join commerce.orders order_row
    on order_row.id = proof_row.order_id
  where proof_row.owner_user_id = target_owner_user_id;
$$;

create or replace function public.server_get_order_proof_context(
  target_buyer_user_id uuid,
  target_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_payload jsonb;
  wallet_payload jsonb;
begin
  select jsonb_build_object(
    'id', order_row.id,
    'order_number', order_row.order_number,
    'buyer_id', order_row.buyer_id,
    'accepted_quote_version_id', order_row.accepted_quote_version_id,
    'deposit_invoice_id', order_row.deposit_invoice_id,
    'status', order_row.status
  )
  into order_payload
  from commerce.orders order_row
  where order_row.id = target_order_id
    and order_row.buyer_id = target_buyer_user_id;

  if order_payload is null then
    return null;
  end if;

  select jsonb_build_object(
    'address', wallet_account.address
  )
  into wallet_payload
  from wallet.accounts wallet_account
  where wallet_account.user_id = target_buyer_user_id
    and wallet_account.chain_id = 5042002
    and wallet_account.is_primary
    and wallet_account.verified_at is not null
  order by wallet_account.verified_at desc
  limit 1;

  return jsonb_build_object(
    'order', order_payload,
    'wallet', wallet_payload
  );
end;
$$;

revoke all on function public.server_list_purchased_order_proofs(uuid)
from public, anon, authenticated;

revoke all on function public.server_get_order_proof_context(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.server_list_purchased_order_proofs(uuid)
to service_role;

grant execute on function public.server_get_order_proof_context(uuid, uuid)
to service_role;
