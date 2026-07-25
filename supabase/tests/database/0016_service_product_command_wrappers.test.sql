begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(13);

select has_function(
  'public',
  'server_set_product_availability',
  array['uuid', 'bigint', 'bigint', 'text', 'text', 'timestamp with time zone', 'integer', 'uuid', 'text'],
  'service availability wrapper exists'
);
select has_function(
  'public',
  'server_archive_product',
  array['uuid', 'bigint', 'bigint', 'text', 'uuid', 'text'],
  'service archive wrapper exists'
);
select has_function(
  'public',
  'server_restore_archived_product',
  array['uuid', 'bigint', 'bigint', 'uuid'],
  'service restore wrapper exists'
);
select has_function(
  'public',
  'server_delete_product_draft',
  array['uuid', 'bigint', 'bigint', 'text', 'uuid'],
  'service draft delete wrapper exists'
);
select has_function(
  'public',
  'server_adjust_variant_inventory',
  array['uuid', 'bigint', 'bigint', 'text', 'integer', 'text', 'integer', 'uuid', 'uuid', 'text'],
  'service inventory wrapper exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.server_set_product_availability(uuid,bigint,bigint,text,text,timestamptz,integer,uuid,text)',
    'EXECUTE'
  ),
  'authenticated users cannot execute service wrapper'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.server_set_product_availability(uuid,bigint,bigint,text,text,timestamptz,integer,uuid,text)',
    'EXECUTE'
  ),
  'service role can execute service wrapper'
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
    '55555555-5555-4555-8555-555555555555',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'command-seller@loomon.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'command-outsider@loomon.test',
    '',
    now(),
    now(),
    now()
  )
on conflict (id) do nothing;

insert into catalog.maker_memberships(maker_id, user_id, role, status)
select id, '55555555-5555-4555-8555-555555555555', 'owner', 'active'
from catalog.makers
where slug = 'lo-may'
on conflict (maker_id, user_id)
do update set role = excluded.role, status = excluded.status;

insert into catalog.products(maker_id, slug, status, created_by)
select
  id,
  'service-wrapper-test-draft',
  'draft',
  '55555555-5555-4555-8555-555555555555'
from catalog.makers
where slug = 'lo-may';

select lives_ok(
  $$
    select public.server_set_product_availability(
      '55555555-5555-4555-8555-555555555555',
      (select id from catalog.makers where slug = 'lo-may'),
      (select id from catalog.products where slug = 'service-wrapper-test-draft'),
      'paused',
      'test pause',
      now() + interval '1 day',
      1,
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'seller'
    )
  $$,
  'service wrapper applies the verified seller actor'
);

select is(
  (
    select status
    from catalog.product_availability
    where product_id = (
      select id from catalog.products where slug = 'service-wrapper-test-draft'
    )
  ),
  'paused',
  'service wrapper updates availability'
);

select lives_ok(
  $$
    select public.server_set_product_availability(
      '55555555-5555-4555-8555-555555555555',
      (select id from catalog.makers where slug = 'lo-may'),
      (select id from catalog.products where slug = 'service-wrapper-test-draft'),
      'paused',
      'test pause',
      now() + interval '1 day',
      1,
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'seller'
    )
  $$,
  'duplicate service command returns its cached result'
);

select is(
  (
    select count(*)::integer
    from catalog.product_availability_history
    where request_key = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  ),
  1,
  'duplicate command creates one history row'
);

select throws_ok(
  $$
    select public.server_set_product_availability(
      '66666666-6666-4666-8666-666666666666',
      (select id from catalog.makers where slug = 'lo-may'),
      (select id from catalog.products where slug = 'service-wrapper-test-draft'),
      'out_of_stock',
      'unauthorized',
      null,
      2,
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
      'seller'
    )
  $$,
  'P0001',
  'NOT_AUTHORIZED',
  'service wrapper preserves maker authorization'
);

select throws_ok(
  $$
    select public.server_set_product_availability(
      '55555555-5555-4555-8555-555555555555',
      (select id from catalog.makers where slug = 'lam-xuong'),
      (select id from catalog.products where slug = 'service-wrapper-test-draft'),
      'out_of_stock',
      'wrong selected maker',
      null,
      2,
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
      'seller'
    )
  $$,
  'P0001',
  'TARGET_MAKER_MISMATCH',
  'service wrapper binds the command to the selected maker context'
);

select * from finish();
rollback;
