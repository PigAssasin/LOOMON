insert into catalog.vocabularies(code, description) values
  ('category', 'Primary product category'),
  ('material', 'Canonical material'),
  ('technique', 'Making technique'),
  ('finish', 'Finish and glaze family'),
  ('color_family', 'Controlled color family'),
  ('style', 'Visual and historical style'),
  ('occasion', 'Buyer occasion'),
  ('recipient', 'Intended recipient'),
  ('usage', 'Product usage'),
  ('cultural_region', 'Cultural or production region'),
  ('sustainability', 'Sustainability characteristic'),
  ('customization_capability', 'Supported customization')
on conflict (code) do nothing;

with category_vocabulary as (
  select id from catalog.vocabularies where code = 'category'
)
insert into catalog.terms(vocabulary_id, code, sort_order)
select category_vocabulary.id, seed.code, seed.sort_order
from category_vocabulary
cross join (
  values ('drinkware', 10), ('tableware', 20), ('decor', 30), ('tea', 40), ('gifts', 50)
) as seed(code, sort_order)
on conflict (vocabulary_id, code) do nothing;

insert into catalog.term_localizations(term_id, locale, label)
select t.id, localization.locale, localization.label
from catalog.terms t
join catalog.vocabularies v on v.id = t.vocabulary_id and v.code = 'category'
join (
  values
    ('drinkware', 'vi', 'Đồ uống'), ('drinkware', 'en', 'Drinkware'),
    ('tableware', 'vi', 'Đồ bàn ăn'), ('tableware', 'en', 'Tableware'),
    ('decor', 'vi', 'Trang trí'), ('decor', 'en', 'Decor'),
    ('tea', 'vi', 'Trà'), ('tea', 'en', 'Tea'),
    ('gifts', 'vi', 'Quà tặng'), ('gifts', 'en', 'Gifts')
) as localization(code, locale, label) on localization.code = t.code
on conflict (term_id, locale) do update set label = excluded.label;

insert into catalog.customization_definitions(
  code,
  input_type,
  value_type,
  affects_price,
  affects_lead_time
) values
  ('logo_decal', 'asset_upload', 'image', true, true),
  ('engraving', 'text', 'string', true, true),
  ('custom_color', 'select', 'term', true, true),
  ('custom_dimensions', 'number', 'millimeter', true, true),
  ('gift_packaging', 'select', 'option', true, true),
  ('message_card', 'text', 'string', true, false)
on conflict (code) do nothing;

insert into catalog.makers(
  slug,
  display_name,
  story,
  verification_status,
  province_code,
  default_moq,
  default_lead_time_min_days,
  default_lead_time_max_days
) values
  ('lo-may', 'Lò Mây', 'A small-batch stoneware workshop working with quiet glazes and hand-thrown forms.', 'verified', 'Hà Nội', 12, 14, 28),
  ('dat-studio', 'Đất Studio', 'A Hội An studio preserving visible turning marks and mineral-rich clay bodies.', 'verified', 'Quảng Nam', 12, 12, 24),
  ('nang-gom', 'Nắng Gốm', 'A Bình Dương practice centered on terracotta, carving and smoke-fired surfaces.', 'verified', 'Bình Dương', 8, 16, 30),
  ('lam-xuong', 'Lam Xưởng', 'A Huế porcelain studio painting botanical and lotus motifs in cobalt by hand.', 'verified', 'Thừa Thiên Huế', 6, 20, 38),
  ('moc-nhien', 'Mộc Nhiên', 'A Đà Lạt workshop making small-batch ceramics with wood ash and soft forms.', 'verified', 'Lâm Đồng', 20, 10, 24),
  ('tre-may-collective', 'Tre Mây Collective', 'A collective pairing family rattan workshops with reusable gift presentation.', 'verified', 'Hà Nội', 25, 16, 32)
on conflict (slug) do update set
  display_name = excluded.display_name,
  story = excluded.story,
  verification_status = excluded.verification_status,
  province_code = excluded.province_code,
  default_moq = excluded.default_moq,
  default_lead_time_min_days = excluded.default_lead_time_min_days,
  default_lead_time_max_days = excluded.default_lead_time_max_days;

do $$
declare
  slugs text[] := array[
    'celadon-tea-cups', 'river-speckle-serving-bowl', 'terra-field-vase',
    'blue-lotus-teapot', 'lotus-indigo-plate', 'cloud-incense-rest',
    'woven-celebration-box', 'three-seasons-bud-vases', 'morning-rice-bowl-set',
    'heritage-tea-service', 'ember-water-carafe', 'petal-snack-plate',
    'indigo-desk-cup', 'quiet-mountain-burner', 'linen-rattan-keepsake',
    'miniature-moon-vases', 'orchard-sake-cups', 'lotus-sharing-platter',
    'earthline-table-vase', 'celadon-tea-pair', 'artisan-welcome-box',
    'blue-leaf-breakfast-set', 'ash-glaze-flower-cup', 'kiln-story-gift-set'
  ];
  titles text[] := array[
    'Celadon Tea Cups', 'River Speckle Serving Bowl', 'Terra Field Vase',
    'Blue Lotus Teapot', 'Lotus Indigo Plate', 'Cloud Incense Rest',
    'Woven Celebration Box', 'Three Seasons Bud Vases', 'Morning Rice Bowl Set',
    'Heritage Tea Service', 'Ember Water Carafe', 'Petal Snack Plate',
    'Indigo Desk Cup', 'Quiet Mountain Burner', 'Linen & Rattan Keepsake',
    'Miniature Moon Vases', 'Orchard Tasting Cups', 'Lotus Sharing Platter',
    'Earthline Table Vase', 'Celadon Tea Pair', 'Artisan Welcome Box',
    'Blue Leaf Breakfast Set', 'Ash Glaze Flower Cup', 'Kiln Story Gift Set'
  ];
  categories text[] := array[
    'drinkware', 'tableware', 'decor', 'tea', 'tableware', 'decor',
    'gifts', 'decor', 'tableware', 'tea', 'drinkware', 'tableware',
    'drinkware', 'decor', 'gifts', 'decor', 'drinkware', 'tableware',
    'decor', 'tea', 'gifts', 'tableware', 'drinkware', 'gifts'
  ];
  maker_slugs text[] := array[
    'lo-may', 'dat-studio', 'nang-gom', 'lam-xuong',
    'lam-xuong', 'moc-nhien', 'tre-may-collective', 'lo-may'
  ];
  price_values numeric[] := array[
    12, 28, 34, 42, 19, 9, 22, 30, 26, 96, 38, 14,
    16, 18, 27, 24, 11, 54, 20, 29, 46, 62, 15, 58
  ];
  idx integer;
  maker_key bigint;
  product_key bigint;
  version_key bigint;
  variant_key bigint;
  category_key bigint;
begin
  for idx in 1..array_length(slugs, 1) loop
    select id into maker_key
    from catalog.makers
    where slug = maker_slugs[((idx - 1) % array_length(maker_slugs, 1)) + 1];

    insert into catalog.products(maker_id, slug, status)
    values (maker_key, slugs[idx], 'published')
    on conflict (slug) do update set maker_id = excluded.maker_id
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
        case when idx % 3 = 0 then 8 else 20 end,
        14 + (idx % 4) * 2,
        24 + (idx % 5) * 2,
        'VN',
        100
      )
      returning id into version_key;
    end if;

    update catalog.products
    set status = 'published', published_version_id = version_key
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
      titles[idx],
      'Sản phẩm thủ công Việt Nam được chuẩn hóa cho báo giá và đặt hàng.',
      'Một sản phẩm được làm bằng tay tại xưởng Việt Nam, với dữ liệu rõ ràng về vật liệu, số lượng tối thiểu, thời gian sản xuất và khả năng tùy chỉnh.'
    )
    on conflict (product_version_id, locale) do update set
      title = excluded.title,
      short_description = excluded.short_description,
      story = excluded.story;

    insert into catalog.product_variants(product_version_id, variant_code, active)
    values (version_key, 'default', true)
    on conflict (product_version_id, variant_code) do update set active = true
    returning id into variant_key;

    if not exists (
      select 1
      from catalog.price_rules
      where product_version_id = version_key
        and variant_id is null
        and currency_code = 'USDC'
        and minimum_quantity = 1
    ) then
      insert into catalog.price_rules(
        product_version_id,
        currency_code,
        price_type,
        unit_amount,
        minimum_quantity
      ) values (version_key, 'USDC', 'starting_from', price_values[idx], 1);
    end if;

    select t.id into category_key
    from catalog.terms t
    join catalog.vocabularies v on v.id = t.vocabulary_id
    where v.code = 'category' and t.code = categories[idx];

    insert into catalog.product_terms(product_version_id, term_id, source)
    values (version_key, category_key, 'reviewer')
    on conflict (product_version_id, term_id) do update set source = excluded.source;

    insert into search.product_documents(
      product_id,
      product_version_id,
      locale,
      canonical_content,
      source_version
    ) values (
      product_key,
      version_key,
      'vi',
      titles[idx] || ' ' || categories[idx] || ' quà tặng thủ công Việt Nam gốm sứ tùy chỉnh',
      1
    )
    on conflict (product_version_id, locale) do update set
      canonical_content = excluded.canonical_content,
      source_version = excluded.source_version,
      generated_at = now();
  end loop;
end $$;
