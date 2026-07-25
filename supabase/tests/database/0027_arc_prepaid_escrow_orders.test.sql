begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(13);

select has_table(
  'commerce', 'checkout_sessions', 'normalized checkout sessions exist'
);
select has_table(
  'payments', 'maker_payout_destinations', 'maker payout destinations exist'
);
select has_function(
  'public',
  'prepare_prepaid_checkout',
  array['uuid', 'text', 'uuid'],
  'authenticated checkout preparation exists'
);
select has_function(
  'public',
  'server_confirm_prepaid_order',
  array['uuid', 'text', 'bigint', 'integer', 'jsonb'],
  'server-only funding confirmation exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.prepare_prepaid_checkout(uuid,text,uuid)',
    'EXECUTE'
  ),
  'authenticated buyer can prepare checkout'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.prepare_prepaid_checkout(uuid,text,uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot prepare checkout'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.server_confirm_prepaid_order(uuid,text,bigint,integer,jsonb)',
    'EXECUTE'
  ),
  'service role can confirm verified escrow funding'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.server_confirm_prepaid_order(uuid,text,bigint,integer,jsonb)',
    'EXECUTE'
  ),
  'browser clients cannot confirm funding'
);
select ok(
  not has_table_privilege(
    'authenticated', 'commerce.checkout_sessions', 'INSERT'
  ),
  'browser clients cannot insert checkout snapshots directly'
);
select ok(
  not has_table_privilege(
    'authenticated', 'payments.transactions', 'INSERT'
  ),
  'browser clients cannot insert confirmed transactions'
);
select is(
  (
    select count(*)::integer
    from payments.contract_versions
    where chain_id = 5042002
      and contract_name = 'LoomonEscrowPool'
      and version = '1.0.0'
      and status = 'active'
      and lower(implementation_address) =
        '0x71c23bace617d0cdfd2f4dec31d81f5eb08216c7'
  ),
  1,
  'Arc escrow pool v1 is the active contract'
);
select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'commerce'
      and indexname = 'checkout_buyer_status_idx'
  ),
  1,
  'buyer checkout access path is indexed'
);
select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'payments'
      and indexname = 'escrow_onchain_order_id_idx'
  ),
  1,
  'on-chain order replay key is uniquely indexed'
);

select * from finish();
rollback;
