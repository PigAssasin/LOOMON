begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(37);

select has_table('catalog', 'product_availability', 'product availability table exists');
select has_table('catalog', 'variant_inventory', 'variant inventory table exists');
select has_table('catalog', 'product_status_history', 'product status history exists');
select has_table('catalog', 'product_availability_history', 'availability history exists');
select has_table('catalog', 'inventory_movements', 'inventory movements exists');
select has_table('internal', 'product_command_receipts', 'idempotency receipts exist');
select has_table('internal', 'storage_cleanup_jobs', 'storage cleanup queue exists');

select ok(
  exists (
    select 1 from pg_tables
    where schemaname = 'catalog' and tablename = 'product_availability' and rowsecurity
  ),
  'product availability has RLS'
);
select ok(
  exists (
    select 1 from pg_tables
    where schemaname = 'catalog' and tablename = 'variant_inventory' and rowsecurity
  ),
  'variant inventory has RLS'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_product_availability'
  ),
  'availability RPC exists'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_product_draft'
  ),
  'draft delete RPC exists'
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
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'seller-lifecycle@loomon.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'outsider-lifecycle@loomon.test',
    '',
    now(),
    now(),
    now()
  )
on conflict (id) do nothing;

insert into catalog.maker_memberships(maker_id, user_id, role, status)
select id, '11111111-1111-4111-8111-111111111111', 'owner', 'active'
from catalog.makers
where slug = 'lo-may'
on conflict (maker_id, user_id) do update set role = 'owner', status = 'active';

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into catalog.products(maker_id, slug, status, created_by)
select
  id,
  'lifecycle-test-draft',
  'draft',
  '11111111-1111-4111-8111-111111111111'
from catalog.makers
where slug = 'lo-may';

select is(
  (
    select pa.status
    from catalog.product_availability pa
    join catalog.products p on p.id = pa.product_id
    where p.slug = 'lifecycle-test-draft'
  ),
  'available',
  'new draft receives an availability row'
);

select throws_ok(
  $$
    select public.set_product_availability(
      (select id from catalog.products where slug = 'lifecycle-test-draft'),
      'available',
      'test',
      null,
      1,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'seller'
    )
  $$,
  'P0001',
  'PRODUCT_NOT_PUBLISHED',
  'draft cannot be made publicly available'
);

select lives_ok(
  $$
    select public.set_product_availability(
      (select id from catalog.products where slug = 'lifecycle-test-draft'),
      'paused',
      'draft paused',
      now() + interval '1 day',
      1,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'seller'
    )
  $$,
  'seller can pause a draft'
);

select is(
  (
    select pa.status
    from catalog.product_availability pa
    join catalog.products p on p.id = pa.product_id
    where p.slug = 'lifecycle-test-draft'
  ),
  'paused',
  'pause persists'
);

select lives_ok(
  $$
    select public.delete_product_draft(
      (select id from catalog.products where slug = 'lifecycle-test-draft'),
      'lifecycle-test-draft',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
    )
  $$,
  'unreferenced draft can be deleted'
);

select is(
  (select count(*)::integer from catalog.products where slug = 'lifecycle-test-draft'),
  0,
  'deleted draft no longer exists'
);

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);

select throws_ok(
  $$
    select public.archive_product(
      (select id from catalog.products where slug = 'celadon-tea-cups'),
      'unauthorized',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'seller'
    )
  $$,
  'P0001',
  'NOT_AUTHORIZED',
  'unrelated seller cannot archive product'
);

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

select lives_ok(
  $$
    select public.set_product_availability(
      (select id from catalog.products where slug = 'celadon-tea-cups'),
      'paused',
      'seasonal pause',
      now() + interval '7 days',
      (select pa.version from catalog.product_availability pa join catalog.products p on p.id = pa.product_id where p.slug = 'celadon-tea-cups'),
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'seller'
    )
  $$,
  'published product can be paused'
);

select is(
  (select count(*)::integer from public.published_products where slug = 'celadon-tea-cups'),
  0,
  'paused product is removed from sellable public view'
);

select lives_ok(
  $$
    select public.set_product_availability(
      (select id from catalog.products where slug = 'celadon-tea-cups'),
      'paused',
      'seasonal pause',
      now() + interval '7 days',
      1,
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'seller'
    )
  $$,
  'same availability request is idempotent'
);

select is(
  (
    select count(*)::integer
    from catalog.product_availability_history h
    join catalog.products p on p.id = h.product_id
    where p.slug = 'celadon-tea-cups'
      and h.request_key = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  ),
  1,
  'idempotent availability request writes one history row'
);

select lives_ok(
  $$
    select public.set_product_availability(
      (select id from catalog.products where slug = 'celadon-tea-cups'),
      'available',
      'resume',
      null,
      (select pa.version from catalog.product_availability pa join catalog.products p on p.id = pa.product_id where p.slug = 'celadon-tea-cups'),
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
      'seller'
    )
  $$,
  'seller can resume a valid product'
);

select is(
  (select count(*)::integer from public.published_products where slug = 'celadon-tea-cups'),
  1,
  'resumed product returns to sellable public view'
);

select throws_ok(
  $$
    select public.delete_product_draft(
      (select id from catalog.products where slug = 'celadon-tea-cups'),
      'celadon-tea-cups',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
    )
  $$,
  'P0001',
  'PRODUCT_MUST_BE_ARCHIVED',
  'published product cannot be hard deleted'
);

select lives_ok(
  $$
    select public.archive_product(
      (select id from catalog.products where slug = 'celadon-tea-cups'),
      'catalog cleanup',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
      'seller'
    )
  $$,
  'published product can be archived'
);

select is(
  (select status from catalog.products where slug = 'celadon-tea-cups'),
  'archived',
  'archive changes editorial status'
);
select is(
  (
    select pa.status
    from catalog.product_availability pa
    join catalog.products p on p.id = pa.product_id
    where p.slug = 'celadon-tea-cups'
  ),
  'discontinued',
  'archive changes operational availability'
);
select ok(
  exists (
    select 1
    from catalog.product_versions pv
    join catalog.products p on p.id = pv.product_id
    where p.slug = 'celadon-tea-cups'
  ),
  'archive preserves product versions'
);

select lives_ok(
  $$
    select public.restore_archived_product(
      (select id from catalog.products where slug = 'celadon-tea-cups'),
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc5'
    )
  $$,
  'archived product can be restored after validation'
);

select is(
  (select status from catalog.products where slug = 'celadon-tea-cups'),
  'published',
  'restore returns editorial status to published'
);

select lives_ok(
  $$
    select public.adjust_variant_inventory(
      (select pv.id from catalog.product_variants pv join catalog.product_versions version on version.id = pv.product_version_id join catalog.products p on p.id = version.product_id where p.slug = 'celadon-tea-cups' limit 1),
      'receive',
      10,
      'initial stock',
      1,
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      null,
      'seller'
    )
  $$,
  'seller can receive finite stock'
);

select lives_ok(
  $$
    select public.adjust_variant_inventory(
      (select pv.id from catalog.product_variants pv join catalog.product_versions version on version.id = pv.product_version_id join catalog.products p on p.id = version.product_id where p.slug = 'celadon-tea-cups' limit 1),
      'reserve',
      4,
      'test reservation',
      2,
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
      null,
      'seller'
    )
  $$,
  'stock can be reserved'
);

select is(
  (
    select vi.available_to_sell
    from catalog.variant_inventory vi
    join catalog.product_variants pv on pv.id = vi.variant_id
    join catalog.product_versions version on version.id = pv.product_version_id
    join catalog.products p on p.id = version.product_id
    where p.slug = 'celadon-tea-cups'
    limit 1
  ),
  6,
  'available-to-sell accounts for reservation'
);

select throws_ok(
  $$
    select public.adjust_variant_inventory(
      (select pv.id from catalog.product_variants pv join catalog.product_versions version on version.id = pv.product_version_id join catalog.products p on p.id = version.product_id where p.slug = 'celadon-tea-cups' limit 1),
      'reserve',
      7,
      'too much',
      3,
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
      null,
      'seller'
    )
  $$,
  'P0001',
  'INSUFFICIENT_STOCK',
  'reservation cannot exceed available stock'
);

select lives_ok(
  $$
    select public.adjust_variant_inventory(
      (select pv.id from catalog.product_variants pv join catalog.product_versions version on version.id = pv.product_version_id join catalog.products p on p.id = version.product_id where p.slug = 'celadon-tea-cups' limit 1),
      'release',
      4,
      'release test reservation',
      3,
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
      null,
      'seller'
    )
  $$,
  'reservation can be released'
);

select is(
  (
    select vi.reserved
    from catalog.variant_inventory vi
    join catalog.product_variants pv on pv.id = vi.variant_id
    join catalog.product_versions version on version.id = pv.product_version_id
    join catalog.products p on p.id = version.product_id
    where p.slug = 'celadon-tea-cups'
    limit 1
  ),
  0,
  'release returns reserved count to zero'
);

select * from finish();

rollback;
