create table search.product_documents (
  id bigint generated always as identity primary key,
  product_id bigint not null references catalog.products(id) on delete cascade,
  product_version_id bigint not null references catalog.product_versions(id) on delete cascade,
  locale text not null check (locale in ('vi', 'en')),
  canonical_content text not null,
  fts tsvector generated always as (to_tsvector('simple', canonical_content)) stored,
  embedding extensions.vector(512),
  embedding_model text,
  embedding_dimensions integer,
  embedding_version text,
  source_version integer not null,
  generated_at timestamptz not null default now(),
  unique(product_version_id, locale)
);
create index product_documents_fts_idx on search.product_documents using gin(fts);
create index product_documents_embedding_idx on search.product_documents using hnsw (embedding vector_cosine_ops) where embedding is not null;
create index product_documents_product_idx on search.product_documents(product_id, locale);

create or replace view public.published_products
with (security_invoker = true)
as
select
  p.id,
  p.slug,
  p.maker_id,
  m.display_name as maker_name,
  m.province_code,
  pv.id as product_version_id,
  pv.production_model,
  pv.customizable,
  pv.minimum_order_quantity,
  pv.lead_time_min_days,
  pv.lead_time_max_days,
  pl.locale,
  pl.title,
  pl.short_description,
  pl.story,
  price.currency_code,
  price.unit_amount as price_from
from catalog.products p
join catalog.product_versions pv on pv.id = p.published_version_id
join catalog.product_localizations pl on pl.product_version_id = pv.id
join catalog.makers m on m.id = p.maker_id
left join lateral (
  select pr.currency_code, min(pr.unit_amount) as unit_amount
  from catalog.price_rules pr
  where pr.product_version_id = pv.id
    and pr.price_type <> 'quote_only'
    and (pr.valid_until is null or pr.valid_until > now())
  group by pr.currency_code
  order by case when pr.currency_code = 'USDC' then 0 else 1 end
  limit 1
) price on true
where p.status = 'published'
  and pv.workflow_status = 'published'
  and m.verification_status = 'verified';

create or replace function public.search_published_products(
  query_text text,
  requested_locale text default 'vi',
  result_limit integer default 20,
  maximum_unit_amount numeric default null,
  requested_quantity integer default null,
  maximum_lead_time_days integer default null
)
returns table (
  product_id bigint,
  product_version_id bigint,
  slug text,
  title text,
  maker_name text,
  minimum_order_quantity integer,
  lead_time_min_days integer,
  lead_time_max_days integer,
  price_from numeric,
  currency_code text,
  keyword_rank real
)
language sql
stable
set search_path = ''
as $$
  select
    pp.id,
    pp.product_version_id,
    pp.slug,
    pp.title,
    pp.maker_name,
    pp.minimum_order_quantity,
    pp.lead_time_min_days,
    pp.lead_time_max_days,
    pp.price_from,
    pp.currency_code,
    ts_rank(pd.fts, websearch_to_tsquery('simple', extensions.unaccent(query_text))) as keyword_rank
  from public.published_products pp
  join search.product_documents pd on pd.product_version_id = pp.product_version_id and pd.locale = pp.locale
  where pp.locale = requested_locale
    and (trim(query_text) = '' or pd.fts @@ websearch_to_tsquery('simple', extensions.unaccent(query_text)))
    and (maximum_unit_amount is null or pp.price_from <= maximum_unit_amount)
    and (requested_quantity is null or pp.minimum_order_quantity <= requested_quantity)
    and (maximum_lead_time_days is null or pp.lead_time_max_days <= maximum_lead_time_days)
  order by ts_rank(pd.fts, websearch_to_tsquery('simple', extensions.unaccent(query_text))) desc, pp.id desc
  limit least(greatest(result_limit, 1), 50)
$$;

create or replace function catalog.publish_product_version(target_version_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_product_id bigint;
  previous_version_id bigint;
begin
  select product_id into target_product_id
  from catalog.product_versions
  where id = target_version_id and workflow_status = 'approved'
  for update;

  if target_product_id is null then
    raise exception 'Version is not approved';
  end if;

  if not exists (
    select 1 from catalog.maker_memberships mm
    join catalog.products p on p.maker_id = mm.maker_id
    where p.id = target_product_id
      and mm.user_id = (select auth.uid())
      and mm.status = 'active'
      and mm.role in ('owner', 'manager')
  ) then
    raise exception 'Not authorized to publish this product';
  end if;

  select published_version_id into previous_version_id from catalog.products where id = target_product_id;

  update catalog.product_versions set workflow_status = 'superseded', updated_at = now()
  where id = previous_version_id and previous_version_id is not null;

  update catalog.product_versions set workflow_status = 'published', updated_at = now()
  where id = target_version_id;

  update catalog.products set status = 'published', published_version_id = target_version_id, updated_at = now()
  where id = target_product_id;
end;
$$;
