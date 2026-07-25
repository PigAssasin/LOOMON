begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(7);

select has_function(
  'public',
  'server_get_product_reference_impact',
  array['uuid', 'bigint', 'bigint'],
  'product reference impact read model exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.server_get_product_reference_impact(uuid,bigint,bigint)',
    'EXECUTE'
  ),
  'authenticated users cannot call the service read model'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.server_get_product_reference_impact(uuid,bigint,bigint)',
    'EXECUTE'
  ),
  'service role can call the service read model'
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
    '77777777-7777-4777-8777-777777777777',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'impact-seller@loomon.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'impact-outsider@loomon.test',
    '',
    now(),
    now(),
    now()
  )
on conflict (id) do nothing;

insert into catalog.maker_memberships(maker_id, user_id, role, status)
select id, '77777777-7777-4777-8777-777777777777', 'owner', 'active'
from catalog.makers
where slug = 'lo-may'
on conflict (maker_id, user_id)
do update set role = excluded.role, status = excluded.status;

insert into catalog.products(maker_id, slug, status, created_by)
select
  id,
  'reference-impact-test-draft',
  'draft',
  '77777777-7777-4777-8777-777777777777'
from catalog.makers
where slug = 'lo-may';

select is(
  (
    public.server_get_product_reference_impact(
      '77777777-7777-4777-8777-777777777777',
      (select id from catalog.makers where slug = 'lo-may'),
      (select id from catalog.products where slug = 'reference-impact-test-draft')
    )->>'can_hard_delete'
  )::boolean,
  true,
  'unreferenced draft can be hard deleted'
);
select is(
  public.server_get_product_reference_impact(
    '77777777-7777-4777-8777-777777777777',
    (select id from catalog.makers where slug = 'lo-may'),
    (select id from catalog.products where slug = 'reference-impact-test-draft')
  )->>'recommended_action',
  'delete_draft',
  'unreferenced draft recommends draft deletion'
);
select is(
  (
    public.server_get_product_reference_impact(
      '77777777-7777-4777-8777-777777777777',
      (select id from catalog.makers where slug = 'lo-may'),
      (select id from catalog.products where slug = 'reference-impact-test-draft')
    )#>>'{references,orders}'
  )::integer,
  0,
  'read model reports zero order references'
);
select throws_ok(
  $$
    select public.server_get_product_reference_impact(
      '88888888-8888-4888-8888-888888888888',
      (select id from catalog.makers where slug = 'lo-may'),
      (select id from catalog.products where slug = 'reference-impact-test-draft')
    )
  $$,
  'P0001',
  'NOT_AUTHORIZED',
  'cross-maker reference inspection is denied'
);

select * from finish();
rollback;
