-- Keep the public LOOMON demo catalog aligned with the current submission scope:
-- one seller (Lo May) and ceramic/tea/tableware custom souvenirs only.

do $$
declare
  lo_may_id bigint;
begin
  select id into lo_may_id from catalog.makers where slug = 'lo-may';
  if lo_may_id is null then
    raise exception 'lo_may_maker_required';
  end if;

  update catalog.makers
  set verification_status = case when slug = 'lo-may' then 'verified' else 'suspended' end,
      default_moq = case when slug = 'lo-may' then 1 else default_moq end,
      updated_at = now()
  where slug in ('lo-may', 'dat-studio', 'nang-gom', 'lam-xuong', 'moc-nhien', 'tre-may-collective');

  update catalog.products
  set status = 'archived',
      updated_at = now()
  where slug in (
    'cloud-incense-rest',
    'woven-celebration-box',
    'indigo-desk-cup',
    'quiet-mountain-burner',
    'linen-rattan-keepsake',
    'artisan-welcome-box',
    'kiln-story-gift-set'
  );

  update catalog.products
  set maker_id = lo_may_id,
      status = 'published',
      updated_at = now()
  where slug in (
    'celadon-tea-cups',
    'blue-lotus-teapot',
    'lotus-indigo-plate',
    'river-speckle-serving-bowl',
    'terra-field-vase',
    'three-seasons-bud-vases',
    'morning-rice-bowl-set',
    'heritage-tea-service',
    'ember-water-carafe',
    'petal-snack-plate',
    'lotus-sharing-platter',
    'blue-leaf-breakfast-set'
  );

  update catalog.product_versions version
  set minimum_order_quantity = 1,
      customizable = true,
      updated_at = now()
  from catalog.products product
  where product.published_version_id = version.id
    and product.slug in (
      'celadon-tea-cups',
      'blue-lotus-teapot',
      'lotus-indigo-plate',
      'river-speckle-serving-bowl',
      'terra-field-vase',
      'three-seasons-bud-vases',
      'morning-rice-bowl-set',
      'heritage-tea-service',
      'ember-water-carafe',
      'petal-snack-plate',
      'lotus-sharing-platter',
      'blue-leaf-breakfast-set'
    );

  update catalog.terms term
  set status = 'deprecated'
  from catalog.vocabularies vocabulary
  where vocabulary.id = term.vocabulary_id
    and vocabulary.code = 'category'
    and term.code = 'gifts';
end;
$$;

create index if not exists messages_thread_created_idx
  on messaging.messages(thread_id, created_at);

create index if not exists message_attachments_message_created_idx
  on messaging.message_attachments(message_id, created_at);

create index if not exists escrow_instances_buyer_status_idx
  on payments.escrow_instances(lower(buyer_address), status, updated_at desc);

create index if not exists escrow_instances_merchant_status_idx
  on payments.escrow_instances(lower(merchant_address), status, updated_at desc);
