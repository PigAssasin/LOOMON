-- Final demo catalog scope for LOOMON:
-- four affordable Vietnamese ceramic products, one seller, MOQ 1, all below 10 USDC.

do $$
declare
  lo_may_id bigint;
  slug text;
  product_key bigint;
  version_key bigint;
  category_key bigint;
  variant_key bigint;
  demo_slugs text[] := array[
    'celadon-tea-cups',
    'blue-lotus-tea-set',
    'speckled-rice-bowl',
    'lotus-cup-coasters'
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

  foreach slug in array demo_slugs loop
    insert into catalog.products(maker_id, slug, status)
    values (lo_may_id, slug, 'published')
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
        case slug
          when 'lotus-cup-coasters' then 7
          when 'blue-lotus-tea-set' then 14
          else 10
        end,
        case slug
          when 'lotus-cup-coasters' then 14
          when 'blue-lotus-tea-set' then 24
          else 18
        end,
        'VN',
        100
      )
      returning id into version_key;
    end if;

    update catalog.product_versions
    set workflow_status = 'published',
        customizable = true,
        minimum_order_quantity = 1,
        lead_time_min_days = case slug
          when 'lotus-cup-coasters' then 7
          when 'blue-lotus-tea-set' then 14
          else 10
        end,
        lead_time_max_days = case slug
          when 'lotus-cup-coasters' then 14
          when 'blue-lotus-tea-set' then 24
          else 18
        end,
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
      case slug
        when 'celadon-tea-cups' then 'Celadon Tea Cups'
        when 'blue-lotus-tea-set' then 'Blue Lotus Tea Set'
        when 'speckled-rice-bowl' then 'Speckled Rice Bowl'
        else 'Lotus Cup Coasters'
      end,
      'Vietnamese ceramic souvenir prepared for AI-assisted customization and Arc testnet checkout.',
      case slug
        when 'celadon-tea-cups' then 'A pair of calm celadon cups for names, logos and small custom symbols.'
        when 'blue-lotus-tea-set' then 'A blue-and-white tea set inspired by Vietnamese porcelain, made for a personal mark across pot and cups.'
        when 'speckled-rice-bowl' then 'A warm stoneware bowl with a quiet handmade surface, designed for small marks and meaningful inscriptions.'
        else 'Small ceramic coasters that turn a logo, event mark or illustrated symbol into an affordable collectible souvenir.'
      end
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
    set unit_amount = case slug
          when 'celadon-tea-cups' then 3
          when 'blue-lotus-tea-set' then 7
          when 'speckled-rice-bowl' then 4
          else 2
        end,
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
        case slug
          when 'celadon-tea-cups' then 3
          when 'blue-lotus-tea-set' then 7
          when 'speckled-rice-bowl' then 4
          else 2
        end,
        1
      );
    end if;

    select t.id into category_key
    from catalog.terms t
    join catalog.vocabularies v on v.id = t.vocabulary_id
    where v.code = 'category'
      and t.code = case
        when slug = 'celadon-tea-cups' then 'drinkware'
        when slug = 'blue-lotus-tea-set' then 'tea'
        else 'tableware'
      end;

    if category_key is not null then
      insert into catalog.product_terms(product_version_id, term_id, source)
      values (version_key, category_key, 'demo_scope')
      on conflict do nothing;
    end if;
  end loop;
end;
$$;
