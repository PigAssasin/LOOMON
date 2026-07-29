-- Make the demo order workspace wallet-native and repair DB/onchain projection drift.

create or replace function public.get_wallet_buyer_workspace(p_wallet_address text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_wallet_address !~ '^0x[0-9a-fA-F]{40}$'
      then jsonb_build_object(
        'buyingRequests', '[]'::jsonb,
        'sellingRequests', '[]'::jsonb,
        'buyingOrders', '[]'::jsonb,
        'sellingOrders', '[]'::jsonb
      )
    else jsonb_build_object(
      'buyingRequests', '[]'::jsonb,
      'sellingRequests', '[]'::jsonb,
      'sellingOrders', '[]'::jsonb,
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
            'buyerName', coalesce(profile.display_name, 'Buyer'),
            'productId', product.id,
            'productSlug', product.slug,
            'productTitle', coalesce(localized.title, product.slug),
            'quantity', item.quantity,
            'threadId', thread.id
          ) as row_data
          from commerce.orders order_record
          join payments.escrow_instances escrow on escrow.order_id = order_record.id
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
          where lower(escrow.buyer_address) = lower(p_wallet_address)
        ) buying_order_rows
      ), '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.get_wallet_buyer_workspace(text) from public, anon, authenticated;
grant execute on function public.get_wallet_buyer_workspace(text) to service_role;

create or replace function public.server_project_escrow_action(
  p_order_id uuid,
  p_action text,
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
  order_record commerce.orders%rowtype;
  escrow_record payments.escrow_instances%rowtype;
  previous_status text;
  next_order_status text;
  next_escrow_status text;
  event_name text;
  actor_kind text;
  claimable_at timestamptz;
begin
  if p_action not in (
    'start_production', 'mark_delivered', 'confirm_completion',
    'claim', 'cancel', 'refund', 'dispute'
  ) then raise exception 'invalid_escrow_action'; end if;
  if p_transaction_hash !~ '^0x[0-9a-fA-F]{64}$'
    or p_block_number is null or p_block_number < 0
    or p_log_index is null or p_log_index < 0
  then raise exception 'invalid_verified_event'; end if;

  if exists (
    select 1 from payments.chain_events
    where chain_id = 5042002
      and transaction_hash = lower(p_transaction_hash)
      and log_index = p_log_index
  ) then
    select orders.* into order_record
    from commerce.orders orders where orders.id = p_order_id;
    return jsonb_build_object(
      'orderId', order_record.id,
      'orderReference', order_record.order_number,
      'status', order_record.status,
      'idempotent', true
    );
  end if;

  select * into order_record
  from commerce.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  select * into escrow_record
  from payments.escrow_instances where order_id = p_order_id for update;
  if not found then raise exception 'escrow_not_found'; end if;
  previous_status := order_record.status;

  if p_action = 'start_production' then
    if previous_status = 'in_production' then
      return jsonb_build_object(
        'orderId', order_record.id,
        'orderReference', order_record.order_number,
        'status', order_record.status,
        'idempotent', true
      );
    end if;
    if previous_status <> 'escrow_funded' then raise exception 'invalid_order_state'; end if;
    next_order_status := 'in_production';
    next_escrow_status := 'in_production';
    event_name := 'ProductionStarted';
    actor_kind := 'seller';
  elsif p_action = 'mark_delivered' then
    if previous_status not in ('escrow_funded', 'in_production') then raise exception 'invalid_order_state'; end if;
    next_order_status := 'seller_marked_delivered';
    next_escrow_status := 'delivered';
    event_name := 'OrderDelivered';
    actor_kind := 'seller';
  elsif p_action = 'confirm_completion' then
    if previous_status <> 'seller_marked_delivered' then raise exception 'invalid_order_state'; end if;
    next_order_status := 'release_hold';
    next_escrow_status := 'release_hold';
    event_name := 'CompletionConfirmed';
    actor_kind := 'buyer';
    claimable_at := to_timestamp((p_event_payload ->> 'sellerClaimableAt')::double precision);
    if claimable_at < now() + interval '6 days 23 hours' then
      raise exception 'invalid_release_hold';
    end if;
  elsif p_action = 'claim' then
    if previous_status <> 'release_hold' then raise exception 'invalid_order_state'; end if;
    next_order_status := 'released';
    next_escrow_status := 'released';
    event_name := 'SellerFundsClaimed';
    actor_kind := 'seller';
  elsif p_action in ('cancel', 'refund') then
    if previous_status not in (
      'escrow_funded', 'in_production', 'seller_marked_delivered'
    ) then raise exception 'invalid_order_state'; end if;
    next_order_status := 'refunded';
    next_escrow_status := 'refunded';
    event_name := 'BuyerRefunded';
    actor_kind := case when p_action = 'cancel' then 'buyer' else 'seller' end;
  else
    if previous_status not in (
      'escrow_funded', 'in_production', 'seller_marked_delivered', 'release_hold'
    ) then raise exception 'invalid_order_state'; end if;
    next_order_status := 'disputed';
    next_escrow_status := 'disputed';
    event_name := 'DisputeRaised';
    actor_kind := 'system';
  end if;

  insert into payments.chain_events(
    chain_id, contract_address, transaction_hash, log_index, block_number,
    event_name, decoded_payload, projection_status, projected_at
  )
  values (
    5042002, escrow_record.escrow_address, lower(p_transaction_hash),
    p_log_index, p_block_number, event_name, p_event_payload,
    'projected', now()
  );

  update payments.escrow_instances
  set
    status = next_escrow_status,
    completed_at = case
      when p_action = 'confirm_completion' then now() else completed_at
    end,
    seller_claimable_at = case
      when p_action = 'confirm_completion' then claimable_at
      else seller_claimable_at
    end,
    released_at = case when p_action = 'claim' then now() else released_at end,
    updated_at = now()
  where id = escrow_record.id;

  update commerce.orders
  set
    status = next_order_status,
    seller_marked_delivered_at = case
      when p_action = 'mark_delivered' then now()
      else seller_marked_delivered_at
    end,
    buyer_confirmed_received_at = case
      when p_action = 'confirm_completion' then now()
      else buyer_confirmed_received_at
    end,
    cancelled_at = case
      when p_action in ('cancel', 'refund') then now() else cancelled_at
    end,
    cancellation_reason = case
      when p_action in ('cancel', 'refund') then 'Refunded on Arc'
      else cancellation_reason
    end,
    updated_at = now()
  where id = order_record.id;

  insert into commerce.order_status_history(
    order_id, from_status, to_status, actor_type, actor_id, reason
  )
  values (
    order_record.id, previous_status, next_order_status, actor_kind, null,
    'Verified Arc event ' || event_name
  );

  insert into messaging.messages(
    thread_id, sender_type, message_kind, structured_body,
    approval_status, sent_at
  )
  select thread.id, 'system', 'status_update',
    jsonb_build_object(
      'event', 'order_' || next_order_status,
      'transactionHash', lower(p_transaction_hash),
      'sellerClaimableAt', claimable_at
    ),
    'sent', now()
  from messaging.threads thread
  where thread.order_id = order_record.id;

  return jsonb_build_object(
    'orderId', order_record.id,
    'orderReference', order_record.order_number,
    'status', next_order_status,
    'sellerClaimableAt', claimable_at,
    'idempotent', false
  );
end;
$$;

revoke all on function public.server_project_escrow_action(
  uuid, text, text, bigint, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.server_project_escrow_action(
  uuid, text, text, bigint, integer, jsonb
) to service_role;
