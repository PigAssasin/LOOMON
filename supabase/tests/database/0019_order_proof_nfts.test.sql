begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(14);

select has_table('commerce', 'order_proof_nfts', 'order proof table exists');
select has_table('commerce', 'order_proof_nft_events', 'order proof event table exists');
select has_table('commerce', 'order_proof_nft_attempts', 'mint attempt table exists');
select has_function(
  'public',
  'server_prepare_delivered_order_proof',
  array['uuid', 'text', 'text', 'text', 'uuid'],
  'delivered-order proof gate exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.server_prepare_delivered_order_proof(uuid,text,text,text,uuid)',
    'EXECUTE'
  ),
  'service role can invoke the delivered-order proof gate'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.server_prepare_delivered_order_proof(uuid,text,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot invoke the proof gate directly'
);
select ok(
  to_regprocedure('public.server_prepare_order_proof(uuid,text,text,text,uuid)') is null,
  'legacy payment-only proof gate is removed'
);

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values (
  '77777777-7777-4777-8777-777777777777',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'proof-buyer@loomon.test', '',
  now(), now(), now()
)
on conflict (id) do nothing;

insert into commerce.quote_requests(
  id, buyer_id, maker_id, status, locale, public_reference
)
select
  '77777777-0000-4000-8000-000000000001',
  '77777777-7777-4777-8777-777777777777',
  id, 'accepted', 'en', 'LM-Q-26-07-NFT001'
from catalog.makers
where slug = 'lo-may';

insert into commerce.quote_versions(
  id, quote_request_id, version_number, status, currency_code,
  subtotal, customization_total, total, deposit_percentage,
  snapshot, issued_at, expires_at
)
values (
  '77777777-0000-4000-8000-000000000002',
  '77777777-0000-4000-8000-000000000001',
  1, 'accepted', 'USDC', 12, 0, 12, 0,
  '{"demo":true}'::jsonb, now(), now() + interval '1 day'
);

insert into commerce.orders(
  id, order_number, buyer_id, maker_id, accepted_quote_version_id,
  status, seller_marked_delivered_at, buyer_confirmed_received_at
)
select
  '77777777-0000-4000-8000-000000000004',
  'LM-26-07-NFT001',
  '77777777-7777-4777-8777-777777777777',
  id,
  '77777777-0000-4000-8000-000000000002',
  'seller_marked_delivered',
  now(),
  null
from catalog.makers
where slug = 'lo-may';

insert into wallet.accounts(
  id, user_id, provider, wallet_type, custody_type, address,
  chain_id, is_primary, verified_at
)
values (
  '77777777-0000-4000-8000-000000000005',
  '77777777-7777-4777-8777-777777777777',
  'rainbowkit', 'external', 'user_controlled',
  '0x2222222222222222222222222222222222222222',
  5042002, true, now()
);

select throws_ok(
  $$
    select public.server_prepare_delivered_order_proof(
      '77777777-0000-4000-8000-000000000004',
      '0x2222222222222222222222222222222222222222',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      '77777777-0000-4000-8000-000000000008'
    )
  $$,
  'DELIVERY_NOT_CONFIRMED',
  'seller delivery alone cannot prepare a proof'
);

insert into commerce.order_status_history(
  order_id, from_status, to_status, actor_type, actor_id, reason, created_at
)
values
  (
    '77777777-0000-4000-8000-000000000004',
    'in_progress', 'seller_marked_delivered', 'seller', null,
    'test delivery', now() - interval '1 minute'
  ),
  (
    '77777777-0000-4000-8000-000000000004',
    'seller_marked_delivered', 'buyer_confirmed_received', 'buyer',
    '77777777-7777-4777-8777-777777777777',
    'test receipt confirmation', now()
  );

update commerce.orders
set
  status = 'buyer_confirmed_received',
  buyer_confirmed_received_at = now()
where id = '77777777-0000-4000-8000-000000000004';

select lives_ok(
  $$
    select public.server_prepare_delivered_order_proof(
      '77777777-0000-4000-8000-000000000004',
      '0x2222222222222222222222222222222222222222',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      '77777777-0000-4000-8000-000000000008'
    )
  $$,
  'buyer-confirmed delivery can prepare one proof'
);
select is(
  (
    select count(*)::integer
    from commerce.order_proof_nfts
    where order_id = '77777777-0000-4000-8000-000000000004'
  ),
  1,
  'one order creates one proof row'
);
select lives_ok(
  $$
    select public.server_prepare_delivered_order_proof(
      '77777777-0000-4000-8000-000000000004',
      '0x2222222222222222222222222222222222222222',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      '77777777-0000-4000-8000-000000000008'
    )
  $$,
  'proof preparation retry is idempotent'
);
select is(
  (
    select status
    from commerce.orders
    where id = '77777777-0000-4000-8000-000000000004'
  ),
  'proof_pending',
  'eligible order moves to proof pending'
);
select ok(
  not has_table_privilege('authenticated', 'commerce.order_proof_nfts', 'INSERT'),
  'authenticated client cannot insert proof rows'
);
select ok(
  has_table_privilege('authenticated', 'commerce.order_proof_nfts', 'SELECT'),
  'authenticated owner can query proofs through RLS'
);

select * from finish();
rollback;
