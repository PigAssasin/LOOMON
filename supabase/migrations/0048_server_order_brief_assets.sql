-- Server-only canonical resolver for order brief assets.
-- Used by Next.js API routes with the service role so seller and buyer views
-- receive the same production brief assets.

create or replace function public.server_get_order_brief_assets(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  order_record commerce.orders%rowtype;
  order_brief_record commerce.order_briefs%rowtype;
  brief_record customization.briefs%rowtype;
  quote_request_id uuid;
  requested_config jsonb := '{}'::jsonb;
  source_asset_id uuid;
  selected_candidate_id uuid;
  approved_asset_id uuid;
  selected_output_asset_id uuid;
  selected_label text;
  assets jsonb;
  has_order_brief boolean := false;
begin
  select * into order_record
  from commerce.orders
  where id = p_order_id;

  if not found then
    raise exception 'order_not_found';
  end if;

  select quote_version.quote_request_id into quote_request_id
  from commerce.quote_versions quote_version
  where quote_version.id = order_record.accepted_quote_version_id;

  select coalesce(item.requested_configuration, '{}'::jsonb)
    into requested_config
  from commerce.quote_request_items item
  where item.quote_request_id = quote_request_id
  order by item.id asc
  limit 1;

  select * into order_brief_record
  from commerce.order_briefs
  where order_id = order_record.id;
  has_order_brief := found;

  if has_order_brief and order_brief_record.brief_id is not null then
    select * into brief_record
    from customization.briefs
    where id = order_brief_record.brief_id;
  end if;

  source_asset_id := brief_record.source_asset_id;
  if source_asset_id is null
    and requested_config ->> 'sourceAssetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    source_asset_id := (requested_config ->> 'sourceAssetId')::uuid;
  end if;

  selected_candidate_id := coalesce(
    brief_record.selected_candidate_id,
    case when has_order_brief then order_brief_record.selected_render_candidate_id else null end
  );
  if selected_candidate_id is null
    and requested_config ->> 'selectedCandidateId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    selected_candidate_id := (requested_config ->> 'selectedCandidateId')::uuid;
  end if;

  if requested_config ->> 'approvedAssetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    approved_asset_id := (requested_config ->> 'approvedAssetId')::uuid;
  elsif requested_config ->> 'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    approved_asset_id := (requested_config ->> 'assetId')::uuid;
  end if;

  if selected_candidate_id is not null then
    select candidate.output_asset_id, coalesce(candidate.label, 'Selected AI preview')
      into selected_output_asset_id, selected_label
    from customization.render_candidates candidate
    where candidate.id = selected_candidate_id;
  end if;

  with wanted(id, label, sort_order) as (
    select source_asset_id, 'Uploaded artwork'::text, 2
    where source_asset_id is not null
    union all
    select selected_output_asset_id, coalesce(selected_label, 'Selected AI preview'), 1
    where selected_output_asset_id is not null
    union all
    select approved_asset_id, 'Selected custom preview'::text, 1
    where approved_asset_id is not null and selected_output_asset_id is null
  ),
  deduped as (
    select distinct on (wanted.id)
      wanted.id,
      wanted.label,
      wanted.sort_order
    from wanted
    order by wanted.id, wanted.sort_order
  ),
  rows as (
    select
      asset.id,
      asset.asset_role,
      asset.storage_bucket,
      asset.storage_path,
      asset.mime_type,
      asset.metadata ->> 'fileName' as file_name,
      deduped.label,
      deduped.sort_order
    from deduped
    join customization.assets asset on asset.id = deduped.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'role', asset_role,
    'bucket', storage_bucket,
    'path', storage_path,
    'mimeType', mime_type,
    'fileName', file_name,
    'label', label
  ) order by sort_order, label), '[]'::jsonb)
  into assets
  from rows;

  return jsonb_build_object(
    'orderId', order_record.id,
    'briefType', brief_record.brief_type,
    'makerNotes', brief_record.maker_notes,
    'assets', assets
  );
end;
$$;

revoke all on function public.server_get_order_brief_assets(uuid) from public, anon, authenticated;
grant execute on function public.server_get_order_brief_assets(uuid) to service_role;
