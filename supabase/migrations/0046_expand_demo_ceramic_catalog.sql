-- Expand the LOOMON demo catalog:
-- fourteen affordable Vietnamese ceramic products, one seller, MOQ 1, all below 10 USDC.

do $$
declare
  lo_may_id bigint;
  item record;
  product_key bigint;
  version_key bigint;
  category_key bigint;
  variant_key bigint;
  demo_slugs text[] := array[
    'celadon-tea-cups',
    'blue-lotus-tea-set',
    'speckled-rice-bowl',
    'lotus-cup-coasters',
    'blue-rim-lotus-cups',
    'celadon-tasting-cups',
    'ivory-footed-tea-cup',
    'indigo-espresso-cups',
    'nested-ash-rice-bowls',
    'celadon-noodle-bowl',
    'lotus-dipping-bowls',
    'indigo-rim-serving-bowl',
    'lotus-gaiwan-cup',
    'celadon-fairness-pitcher'
  ];
begin
  select id into lo_may_id from catalog.makers where slug = 'lo-may';
  if lo_may_id is null then
    raise exception 'lo_may_maker_required';
  end if;

  update catalog.products
  set status = 'archived',
      updated_at = now()
  where slug <> all(demo_slugs);

  for item in
    select *
    from (values
      ('celadon-tea-cups', 'Celadon Tea Cups', 'drinkware', 3::numeric, 10, 18, 'A pair of calm celadon cups for names, logos and small custom symbols.'),
      ('blue-lotus-tea-set', 'Blue Lotus Tea Set', 'tea', 7::numeric, 14, 24, 'A blue-and-white tea set inspired by Vietnamese porcelain, made for a personal mark across pot and cups.'),
      ('speckled-rice-bowl', 'Speckled Rice Bowl', 'tableware', 4::numeric, 10, 18, 'A warm stoneware bowl with a quiet handmade surface, designed for small marks and meaningful inscriptions.'),
      ('lotus-cup-coasters', 'Lotus Cup Coasters', 'tableware', 2::numeric, 7, 14, 'Small ceramic coasters that turn a logo, event mark or illustrated symbol into an affordable collectible souvenir.'),
      ('blue-rim-lotus-cups', 'Blue Rim Lotus Cups', 'drinkware', 3::numeric, 10, 18, 'A gentle pair of lotus cups with enough white space for a custom mark without losing the handmade ceramic mood.'),
      ('celadon-tasting-cups', 'Celadon Tasting Cups', 'tea', 3::numeric, 9, 16, 'Three small tasting cups for tea lovers, built for quiet personalization and compact proof-of-order NFTs.'),
      ('ivory-footed-tea-cup', 'Ivory Footed Tea Cup', 'drinkware', 2::numeric, 8, 15, 'A simple footed tea cup with a warm surface, ideal for a subtle name, year or small emblem.'),
      ('indigo-espresso-cups', 'Indigo Espresso Cups', 'drinkware', 3::numeric, 10, 18, 'Two small indigo cups designed for modern cafe gifts that still feel connected to hand-painted Vietnamese ceramics.'),
      ('nested-ash-rice-bowls', 'Nested Ash Rice Bowls', 'tableware', 5::numeric, 12, 20, 'A nested rice bowl set for daily tables, easy to customize as a family, cafe or restaurant keepsake.'),
      ('celadon-noodle-bowl', 'Celadon Noodle Bowl', 'tableware', 4::numeric, 10, 18, 'A larger celadon bowl with a calm profile, made for noodles, rice dishes and custom marks on the outer wall.'),
      ('lotus-dipping-bowls', 'Lotus Dipping Bowls', 'tableware', 3::numeric, 8, 15, 'Small dipping bowls with lotus details, light enough for souvenirs and expressive enough for custom artwork.'),
      ('indigo-rim-serving-bowl', 'Indigo Rim Serving Bowl', 'tableware', 5::numeric, 12, 22, 'A low serving bowl for shared food and shared memory, ready for a custom emblem or inscription.'),
      ('lotus-gaiwan-cup', 'Lotus Gaiwan Cup', 'tea', 6::numeric, 14, 24, 'A lidded lotus gaiwan that turns traditional tea ritual into a personal object with onchain order proof.'),
      ('celadon-fairness-pitcher', 'Celadon Fairness Pitcher', 'tea', 5::numeric, 12, 20, 'A small fairness pitcher for tea service, with a clean side surface for subtle custom placement.')
    ) as seed(slug, title, category_code, price, lead_min, lead_max, story)
  loop
    insert into catalog.products(maker_id, slug, status)
    values (lo_may_id, item.slug, 'published')
    on conflict (slug) do update
      set maker_id = excluded.maker_id,
          status = 'published',
          updated_at = now()
    returning id into product_key;

    select id into version_key
    from catalog.product_versions
    where product_id = product_key and version_number = 1;

    if version_key is null then
      insert into catalog.product_versions(
        product_id,
        version_number,
        workflow_status,
        customizable,
        minimum_order_quantity,
        lead_time_min_days,
        lead_time_max_days,
        province_of_origin,
        data_quality_score
      ) values (
        product_key,
        1,
        'published',
        true,
        1,
        item.lead_min,
        item.lead_max,
        'VN',
        100
      )
      returning id into version_key;
    end if;

    update catalog.product_versions
    set workflow_status = 'published',
        customizable = true,
        minimum_order_quantity = 1,
        lead_time_min_days = item.lead_min,
        lead_time_max_days = item.lead_max,
        updated_at = now()
    where id = version_key;

    update catalog.products
    set published_version_id = version_key,
        status = 'published',
        updated_at = now()
    where id = product_key;

    insert into catalog.product_localizations(
      product_version_id,
      locale,
      title,
      short_description,
      story
    ) values (
      version_key,
      'vi',
      item.title,
      'Vietnamese ceramic souvenir prepared for AI-assisted customization and Arc testnet checkout.',
      item.story
    )
    on conflict (product_version_id, locale) do update set
      title = excluded.title,
      short_description = excluded.short_description,
      story = excluded.story;

    insert into catalog.product_variants(product_version_id, variant_code, active)
    values (version_key, 'default', true)
    on conflict (product_version_id, variant_code) do update set active = true
    returning id into variant_key;

    update catalog.price_rules
    set unit_amount = item.price,
        minimum_quantity = 1,
        maximum_quantity = null,
        valid_until = null
    where product_version_id = version_key
      and currency_code = 'USDC'
      and variant_id is null;

    if not found then
      insert into catalog.price_rules(
        product_version_id,
        currency_code,
        price_type,
        unit_amount,
        minimum_quantity
      ) values (
        version_key,
        'USDC',
        'starting_from',
        item.price,
        1
      );
    end if;

    select t.id into category_key
    from catalog.terms t
    join catalog.vocabularies v on v.id = t.vocabulary_id
    where v.code = 'category'
      and t.code = item.category_code;

    if category_key is not null then
      insert into catalog.product_terms(product_version_id, term_id, source)
      values (version_key, category_key, 'demo_catalog')
      on conflict do nothing;
    end if;
  end loop;
end;
$$;
