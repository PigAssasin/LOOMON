create or replace function public.server_get_product_reference_impact(
  actor_user_id uuid,
  target_product_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  product_row catalog.products%rowtype;
  availability_row catalog.product_availability%rowtype;
  quote_count integer;
  customization_count integer;
  order_count integer;
begin
  if actor_user_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);

  select * into product_row
  from catalog.products
  where id = target_product_id;

  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if not catalog.has_maker_role(
    product_row.maker_id,
    array['owner', 'manager', 'catalog_editor']
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into availability_row
  from catalog.product_availability
  where product_id = target_product_id;

  select count(distinct quote_request_id)::integer into quote_count
  from commerce.quote_request_items
  where product_id = target_product_id;

  select count(*)::integer into customization_count
  from customization.projects
  where selected_product_id = target_product_id;

  select count(distinct orders.id)::integer into order_count
  from commerce.orders orders
  join commerce.quote_versions quote_version
    on quote_version.id = orders.accepted_quote_version_id
  join commerce.quote_request_items quote_item
    on quote_item.quote_request_id = quote_version.quote_request_id
  where quote_item.product_id = target_product_id;

  return jsonb_build_object(
    'product_id', product_row.id,
    'maker_id', product_row.maker_id,
    'slug', product_row.slug,
    'editorial_status', product_row.status,
    'published_version_id', product_row.published_version_id,
    'availability_status', availability_row.status,
    'availability_version', availability_row.version,
    'references', jsonb_build_object(
      'quotes', quote_count,
      'customization_projects', customization_count,
      'orders', order_count
    ),
    'can_hard_delete',
      product_row.status in ('draft', 'rejected')
      and product_row.published_version_id is null
      and quote_count = 0
      and customization_count = 0
      and order_count = 0,
    'recommended_action',
      case
        when product_row.status in ('draft', 'rejected')
          and product_row.published_version_id is null
          and quote_count = 0
          and customization_count = 0
          and order_count = 0
          then 'delete_draft'
        when product_row.status <> 'archived'
          then 'archive'
        else 'none'
      end
  );
end;
$$;

revoke all on function public.server_get_product_reference_impact(
  uuid, bigint
) from public, anon, authenticated;
grant execute on function public.server_get_product_reference_impact(
  uuid, bigint
) to service_role;

