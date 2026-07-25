begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(8);

select has_function(
  'public',
  'get_my_seller_memberships',
  array[]::text[],
  'seller membership RPC exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_my_seller_memberships()',
    'EXECUTE'
  ),
  'authenticated users can execute seller membership RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_my_seller_memberships()',
    'EXECUTE'
  ),
  'anonymous users cannot execute seller membership RPC'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_seller_memberships'
      and p.prosecdef
  ),
  'seller membership RPC uses invoker security and RLS'
);

insert into auth.users(
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'seller-auth@loomon.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'outsider-auth@loomon.test',
    '',
    now(),
    now(),
    now()
  )
on conflict (id) do nothing;

insert into catalog.maker_memberships(maker_id, user_id, role, status)
select id, '33333333-3333-4333-8333-333333333333', 'owner', 'active'
from catalog.makers
where slug = 'lo-may'
on conflict (maker_id, user_id)
do update set role = excluded.role, status = excluded.status;

insert into catalog.maker_memberships(maker_id, user_id, role, status)
select id, '33333333-3333-4333-8333-333333333333', 'viewer', 'active'
from catalog.makers
where slug = 'lam-xuong'
on conflict (maker_id, user_id)
do update set role = excluded.role, status = excluded.status;

insert into catalog.maker_memberships(maker_id, user_id, role, status)
select id, '33333333-3333-4333-8333-333333333333', 'manager', 'revoked'
from catalog.makers
where slug = 'moc-nhien'
on conflict (maker_id, user_id)
do update set role = excluded.role, status = excluded.status;

select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.get_my_seller_memberships()),
  1,
  'RPC returns only active product-management memberships'
);

select is(
  (select maker_slug from public.get_my_seller_memberships()),
  'lo-may',
  'RPC returns the authenticated seller maker'
);

select set_config(
  'request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',
  true
);

select is(
  (select count(*)::integer from public.get_my_seller_memberships()),
  0,
  'unrelated authenticated user receives no seller memberships'
);

select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*)::integer from public.get_my_seller_memberships()),
  0,
  'missing authenticated user receives no seller memberships'
);

select * from finish();
rollback;
