-- Participant-safe access to customization assets attached to prepaid orders.

create or replace function public.get_order_brief_assets(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  order_record commerce.orders%rowtype;
  brief_record customization.briefs%rowtype;
  assets jsonb;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into order_record
  from commerce.orders
  where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;

  if order_record.buyer_id <> actor_id
    and not catalog.has_maker_role(
      order_record.maker_id,
      array['owner', 'manager', 'order_manager']
    )
  then
    raise exception 'order_access_required' using errcode = '42501';
  end if;

  select brief.* into brief_record
  from commerce.order_briefs order_brief
  join customization.briefs brief on brief.id = order_brief.brief_id
  where order_brief.order_id = order_record.id;

  if brief_record.id is null then
    return jsonb_build_object(
      'orderId', order_record.id,
      'briefType', null,
      'makerNotes', null,
      'assets', '[]'::jsonb
    );
  end if;

  with source_assets as (
    select
      asset.id,
      asset.asset_role,
      asset.storage_bucket,
      asset.storage_path,
      asset.mime_type,
      asset.metadata ->> 'fileName' as file_name,
      'Uploaded artwork' as label
    from customization.assets asset
    where asset.id = brief_record.source_asset_id
  ),
  selected_render_assets as (
    select
      asset.id,
      asset.asset_role,
      asset.storage_bucket,
      asset.storage_path,
      asset.mime_type,
      asset.metadata ->> 'fileName' as file_name,
      coalesce(candidate.label, 'Selected AI preview') as label
    from customization.render_candidates candidate
    join customization.assets asset on asset.id = candidate.output_asset_id
    where candidate.id = brief_record.selected_candidate_id
  ),
  combined_assets as (
    select * from source_assets
    union
    select * from selected_render_assets
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'role', asset_role,
    'bucket', storage_bucket,
    'path', storage_path,
    'mimeType', mime_type,
    'fileName', file_name,
    'label', label
  ) order by label), '[]'::jsonb)
  into assets
  from combined_assets;

  return jsonb_build_object(
    'orderId', order_record.id,
    'briefType', brief_record.brief_type,
    'makerNotes', brief_record.maker_notes,
    'assets', assets
  );
end;
$$;

revoke all on function public.get_order_brief_assets(uuid) from public, anon;
grant execute on function public.get_order_brief_assets(uuid) to authenticated;
