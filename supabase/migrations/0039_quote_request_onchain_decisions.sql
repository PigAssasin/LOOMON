-- Project seller Accept/Reject quote decisions only after the server verifies
-- the Arc QuoteRequestDecided event from the single demo seller wallet.

create or replace function public.server_project_quote_request_decision(
  p_request_id uuid,
  p_action text,
  p_reason text,
  p_request_key uuid,
  p_seller_address text,
  p_decision_contract_address text,
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
  request_record commerce.quote_requests%rowtype;
  item_record commerce.quote_request_items%rowtype;
  quote_record commerce.quote_versions%rowtype;
  order_record commerce.orders%rowtype;
  previous_status text;
  target_status text;
  unit_price numeric(20,6);
  total_price numeric(20,6);
  target_thread_id uuid;
  seller_user_id uuid;
begin
  if p_action not in ('accept', 'reject') then
    raise exception 'invalid_onchain_quote_action' using errcode = '22023';
  end if;
  if lower(p_seller_address) <> '0xd59aa8db407d4219fe4b104ca4142df14301dec4' then
    raise exception 'single_demo_seller_required' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'request_key_required' using errcode = '22023';
  end if;
  if p_decision_contract_address !~ '^0x[0-9a-fA-F]{40}$'
    or p_transaction_hash !~ '^0x[0-9a-fA-F]{64}$'
    or p_block_number is null or p_block_number < 0
    or p_log_index is null or p_log_index < 0
  then
    raise exception 'invalid_verified_quote_event' using errcode = '22023';
  end if;

  if exists (
    select 1
    from payments.chain_events
    where chain_id = 5042002
      and transaction_hash = lower(p_transaction_hash)
      and log_index = p_log_index
  ) then
    select orders.* into order_record
    from commerce.orders orders
    join commerce.quote_versions quote on quote.id = orders.accepted_quote_version_id
    where quote.quote_request_id = p_request_id
    order by orders.created_at desc
    limit 1;
    return jsonb_build_object(
      'requestId', p_request_id,
      'orderId', order_record.id,
      'orderReference', order_record.order_number,
      'status', coalesce((select status from commerce.quote_requests where id = p_request_id), 'unknown'),
      'idempotent', true
    );
  end if;

  select * into request_record
  from commerce.quote_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'request_not_found'; end if;

  if not exists (
    select 1
    from catalog.makers maker
    where maker.id = request_record.maker_id
      and maker.slug = 'lo-may'
  ) then
    raise exception 'single_demo_maker_required' using errcode = '42501';
  end if;

  select user_id into seller_user_id
  from wallet.accounts
  where chain_id = 5042002
    and lower(address) = lower(p_seller_address)
    and verified_at is not null
  order by is_primary desc, created_at
  limit 1;

  select * into item_record
  from commerce.quote_request_items
  where quote_request_id = request_record.id
  order by id
  limit 1;
  if item_record.id is null then raise exception 'request_item_not_found'; end if;

  previous_status := request_record.status;
  if previous_status not in ('submitted', 'seller_review', 'changes_requested') then
    raise exception 'request_not_actionable' using errcode = '22023';
  end if;

  target_status := case when p_action = 'accept' then 'accepted' else 'rejected' end;

  insert into payments.chain_events(
    chain_id, contract_address, transaction_hash, log_index, block_number,
    event_name, decoded_payload, projection_status, projected_at
  )
  values (
    5042002, lower(p_decision_contract_address), lower(p_transaction_hash),
    p_log_index, p_block_number, 'QuoteRequestDecided', p_event_payload,
    'projected', now()
  );

  if p_action = 'accept' then
    select * into order_record
    from commerce.orders
    where maker_id = request_record.maker_id
      and client_request_key = p_request_key;
    if not found then
      select coalesce(price.unit_amount, 0)
      into unit_price
      from catalog.price_rules price
      where price.product_version_id = item_record.product_version_id
        and price.currency_code = 'USDC'
        and price.minimum_quantity <= item_record.quantity
        and (price.maximum_quantity is null or price.maximum_quantity >= item_record.quantity)
        and price.valid_from <= now()
        and (price.valid_until is null or price.valid_until > now())
      order by price.minimum_quantity desc, price.id desc
      limit 1;
      unit_price := coalesce(unit_price, 0);
      total_price := unit_price * item_record.quantity;

      insert into commerce.quote_versions(
        quote_request_id, version_number, status, currency_code, subtotal,
        customization_total, total, deposit_percentage, snapshot, issued_at
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
        0,
        jsonb_build_object(
          'unitPrice', unit_price,
          'quantity', item_record.quantity,
          'demo', true,
          'acceptedByWallet', lower(p_seller_address),
          'onchainDecisionTx', lower(p_transaction_hash)
        ),
        now()
      )
      returning * into quote_record;

      insert into commerce.orders(
        order_number, buyer_id, maker_id, accepted_quote_version_id, status,
        client_request_key
      )
      values (
        'LM-' || to_char(now(), 'YY-MM-') ||
          upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6)),
        request_record.buyer_id,
        request_record.maker_id,
        quote_record.id,
        'seller_accepted',
        p_request_key
      )
      returning * into order_record;

      if request_record.project_id is not null and request_record.brief_id is not null then
        insert into commerce.order_briefs(
          order_id, project_id, brief_id, selected_render_candidate_id, terms_hash
        )
        select
          order_record.id,
          request_record.project_id,
          request_record.brief_id,
          brief.selected_candidate_id,
          encode(extensions.digest(
            order_record.id::text || ':' || request_record.brief_id::text,
            'sha256'
          ), 'hex')
        from customization.briefs brief
        where brief.id = request_record.brief_id
        on conflict (order_id) do nothing;
      end if;

      update messaging.threads
      set order_id = order_record.id, updated_at = now()
      where project_id = request_record.project_id
        and thread_type = 'buyer_seller'
      returning id into target_thread_id;

      insert into commerce.order_status_history(
        order_id, from_status, to_status, actor_type, actor_id, reason
      )
      values (
        order_record.id, null, 'seller_accepted', 'seller', seller_user_id,
        'Seller accepted the request on Arc'
      );
    end if;
  end if;

  update commerce.quote_requests
  set
    status = target_status,
    seller_response_note = case
      when p_action = 'reject' then coalesce(nullif(btrim(p_reason), ''), 'Seller rejected request')
      else seller_response_note
    end,
    decided_at = now(),
    updated_at = now()
  where id = request_record.id;

  insert into commerce.quote_request_status_history(
    quote_request_id, from_status, to_status, actor_type, actor_id, reason,
    correlation_id
  )
  values (
    request_record.id, previous_status, target_status, 'seller', seller_user_id,
    case when p_action = 'reject' then coalesce(nullif(btrim(p_reason), ''), 'Seller rejected request') else null end,
    p_request_key
  );

  select id into target_thread_id
  from messaging.threads
  where project_id = request_record.project_id
    and thread_type = 'buyer_seller'
  limit 1;

  if target_thread_id is not null then
    insert into messaging.messages(
      thread_id, sender_type, message_kind, structured_body,
      approval_status, sent_at
    )
    values (
      target_thread_id,
      'system',
      'status_update',
      jsonb_build_object(
        'event', 'quote_request_' || target_status,
        'requestId', request_record.id,
        'onchainTx', lower(p_transaction_hash),
        'reason', case when p_action = 'reject' then coalesce(nullif(btrim(p_reason), ''), 'Seller rejected request') else null end
      ),
      'sent',
      now()
    );
  end if;

  return jsonb_build_object(
    'requestId', request_record.id,
    'orderId', order_record.id,
    'orderReference', order_record.order_number,
    'status', target_status,
    'transactionHash', lower(p_transaction_hash),
    'idempotent', false
  );
end;
$$;

revoke all on function public.server_project_quote_request_decision(
  uuid, text, text, uuid, text, text, text, bigint, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.server_project_quote_request_decision(
  uuid, text, text, uuid, text, text, text, bigint, integer, jsonb
) to service_role;
