-- Store both buyer source artwork and the selected AI preview for agent-render orders.

drop function if exists public.submit_customization_quote(
  text, text, text, integer, date, uuid, text, text, text, text, bigint, text, text
);

create or replace function public.submit_customization_quote(
  p_product_slug text,
  p_intent text,
  p_notes text,
  p_quantity integer,
  p_required_by date,
  p_client_request_key uuid,
  p_asset_path text default null,
  p_asset_role text default null,
  p_file_name text default null,
  p_mime_type text default null,
  p_asset_bytes bigint default null,
  p_checksum_sha256 text default null,
  p_preview_label text default null,
  p_source_asset_path text default null,
  p_source_file_name text default null,
  p_source_mime_type text default null,
  p_source_asset_bytes bigint default null,
  p_source_checksum_sha256 text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, catalog, customization, commerce, messaging, storage, extensions
as $$
declare
  actor_id uuid := auth.uid();
  target_product_id bigint;
  target_product_version_id bigint;
  target_maker_id bigint;
  target_moq integer;
  target_project_id uuid;
  target_asset_id uuid;
  target_source_asset_id uuid;
  target_batch_id uuid;
  target_candidate_id uuid;
  target_brief_id uuid;
  target_quote_id uuid;
  target_thread_id uuid;
  target_public_reference text;
  target_brief_type text;
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_client_request_key is null then
    raise exception 'request_key_required' using errcode = '22023';
  end if;

  if p_intent not in ('apply_artwork', 'text_only', 'maker_reference') then
    raise exception 'invalid_customization_intent' using errcode = '22023';
  end if;

  if p_required_by is not null and p_required_by < current_date then
    raise exception 'required_date_is_in_the_past' using errcode = '22023';
  end if;

  select qr.id, qr.project_id
  into target_quote_id, target_project_id
  from commerce.quote_requests qr
  where qr.buyer_id = actor_id
    and qr.client_request_key = p_client_request_key;

  if target_quote_id is not null then
    select cp.public_reference
    into target_public_reference
    from customization.projects cp
    where cp.id = target_project_id;

    return jsonb_build_object(
      'quoteRequestId', target_quote_id,
      'projectId', target_project_id,
      'projectReference', target_public_reference,
      'status', 'submitted',
      'idempotent', true
    );
  end if;

  select
    p.id,
    p.published_version_id,
    p.maker_id,
    pv.minimum_order_quantity
  into
    target_product_id,
    target_product_version_id,
    target_maker_id,
    target_moq
  from catalog.products p
  join catalog.product_versions pv on pv.id = p.published_version_id
  join catalog.product_availability pa on pa.product_id = p.id
  where p.slug = p_product_slug
    and p.status = 'published'
    and pv.workflow_status = 'published'
    and pa.status = 'available';

  if target_product_id is null then
    raise exception 'product_not_available' using errcode = 'P0002';
  end if;

  if p_quantity is null or p_quantity < target_moq then
    raise exception 'quantity_below_minimum_order' using errcode = '22023';
  end if;

  if p_intent = 'text_only' and normalized_notes is null then
    raise exception 'text_or_maker_notes_required' using errcode = '22023';
  end if;

  if p_intent <> 'text_only' and p_asset_path is null then
    raise exception 'customization_asset_required' using errcode = '22023';
  end if;

  insert into customization.projects(
    owner_user_id,
    selected_product_id,
    selected_product_version_id,
    status,
    entrypoint,
    locale,
    client_request_key
  )
  values (
    actor_id,
    target_product_id,
    target_product_version_id,
    'customizing',
    'product_detail',
    'en',
    p_client_request_key
  )
  returning id, public_reference
  into target_project_id, target_public_reference;

  if p_source_asset_path is not null then
    if p_source_asset_path !~ ('^' || actor_id::text || '/') then
      raise exception 'source_asset_path_owner_mismatch' using errcode = '42501';
    end if;

    if p_source_mime_type not in ('image/png', 'image/jpeg', 'image/webp')
      or p_source_asset_bytes is null
      or p_source_asset_bytes <= 0
      or p_source_asset_bytes > 5242880
      or p_source_checksum_sha256 !~ '^[0-9a-f]{64}$'
    then
      raise exception 'invalid_source_asset_metadata' using errcode = '22023';
    end if;

    insert into customization.assets(
      project_id,
      owner_user_id,
      asset_role,
      storage_bucket,
      storage_path,
      mime_type,
      bytes,
      checksum_sha256,
      rights_confirmed,
      moderation_status,
      visibility,
      metadata
    )
    values (
      target_project_id,
      actor_id,
      'artwork',
      'customization-assets',
      p_source_asset_path,
      p_source_mime_type,
      p_source_asset_bytes,
      p_source_checksum_sha256,
      true,
      'pending',
      'thread_participants',
      jsonb_build_object(
        'fileName', coalesce(p_source_file_name, 'source-artwork'),
        'intent', p_intent,
        'assetPurpose', 'buyer_source'
      )
    )
    returning id into target_source_asset_id;
  end if;

  if p_asset_path is not null then
    if p_asset_path !~ ('^' || actor_id::text || '/') then
      raise exception 'asset_path_owner_mismatch' using errcode = '42501';
    end if;

    if p_asset_role not in ('artwork', 'agent_render') then
      raise exception 'invalid_asset_role' using errcode = '22023';
    end if;

    if p_mime_type not in ('image/png', 'image/jpeg', 'image/webp')
      or p_asset_bytes is null
      or p_asset_bytes <= 0
      or p_asset_bytes > 5242880
      or p_checksum_sha256 !~ '^[0-9a-f]{64}$'
    then
      raise exception 'invalid_asset_metadata' using errcode = '22023';
    end if;

    insert into customization.assets(
      project_id,
      owner_user_id,
      asset_role,
      storage_bucket,
      storage_path,
      mime_type,
      bytes,
      checksum_sha256,
      rights_confirmed,
      moderation_status,
      visibility,
      metadata
    )
    values (
      target_project_id,
      actor_id,
      p_asset_role,
      'customization-assets',
      p_asset_path,
      p_mime_type,
      p_asset_bytes,
      p_checksum_sha256,
      true,
      'pending',
      'thread_participants',
      jsonb_build_object(
        'fileName', coalesce(p_file_name, 'customization-image'),
        'intent', p_intent,
        'assetPurpose', case when p_asset_role = 'agent_render' then 'selected_preview' else 'buyer_source' end
      )
    )
    returning id into target_asset_id;
  end if;

  if p_asset_role = 'agent_render' then
    insert into customization.render_batches(
      project_id,
      batch_number,
      intent,
      product_version_id,
      provider,
      model,
      fixed_prompt_version,
      status,
      created_by_user_id,
      generated_count,
      completed_at
    )
    values (
      target_project_id,
      1,
      case when p_intent = 'text_only' then 'text_only' else 'apply_artwork' end,
      target_product_version_id,
      'google',
      'gemini-2.5-flash-image',
      'product-locked-v4',
      'completed',
      actor_id,
      1,
      now()
    )
    returning id into target_batch_id;

    insert into customization.render_candidates(
      batch_id,
      candidate_number,
      output_asset_id,
      label,
      status
    )
    values (
      target_batch_id,
      1,
      target_asset_id,
      coalesce(nullif(trim(p_preview_label), ''), 'Selected AI preview'),
      'selected'
    )
    returning id into target_candidate_id;

    target_brief_type := 'agent_render';
  elsif p_intent = 'text_only' then
    target_brief_type := 'text_only';
  elsif normalized_notes is null then
    target_brief_type := 'source_file_only';
  else
    target_brief_type := 'source_file_and_notes';
  end if;

  insert into customization.briefs(
    project_id,
    product_version_id,
    source_asset_id,
    selected_candidate_id,
    brief_type,
    maker_notes,
    status,
    approved_by_user_id,
    approved_at
  )
  values (
    target_project_id,
    target_product_version_id,
    coalesce(target_source_asset_id, case when target_brief_type = 'agent_render' then null else target_asset_id end),
    target_candidate_id,
    target_brief_type,
    normalized_notes,
    'sent_to_seller',
    actor_id,
    now()
  )
  returning id into target_brief_id;

  update customization.projects
  set
    selected_brief_id = target_brief_id,
    selected_render_candidate_id = target_candidate_id,
    status = 'brief_ready',
    updated_at = now()
  where id = target_project_id;

  insert into commerce.quote_requests(
    buyer_id,
    maker_id,
    status,
    locale,
    required_by,
    buyer_note,
    project_id,
    brief_id,
    client_request_key
  )
  values (
    actor_id,
    target_maker_id,
    'submitted',
    'en',
    p_required_by,
    normalized_notes,
    target_project_id,
    target_brief_id,
    p_client_request_key
  )
  returning id into target_quote_id;

  insert into commerce.quote_request_items(
    quote_request_id,
    product_id,
    product_version_id,
    quantity,
    requested_configuration
  )
  values (
    target_quote_id,
    target_product_id,
    target_product_version_id,
    p_quantity,
    jsonb_build_object(
      'projectId', target_project_id,
      'briefId', target_brief_id,
      'intent', p_intent,
      'approvedAssetId', target_asset_id,
      'sourceAssetId', target_source_asset_id,
      'selectedCandidateId', target_candidate_id
    )
  );

  insert into messaging.threads(
    thread_type,
    project_id,
    status,
    title,
    created_by_user_id
  )
  values (
    'buyer_seller',
    target_project_id,
    'open',
    'Quote request ' || target_public_reference,
    actor_id
  )
  returning id into target_thread_id;

  insert into messaging.thread_participants(
    thread_id,
    participant_type,
    user_id,
    role
  )
  values (target_thread_id, 'buyer', actor_id, 'member');

  insert into messaging.thread_participants(
    thread_id,
    participant_type,
    maker_id,
    role
  )
  values (target_thread_id, 'seller', target_maker_id, 'member');

  insert into messaging.messages(
    thread_id,
    sender_type,
    message_kind,
    structured_body,
    approval_status,
    sent_at
  )
  values (
    target_thread_id,
    'system',
    'system_event',
    jsonb_build_object(
      'event', 'quote_requested',
      'quoteRequestId', target_quote_id,
      'projectReference', target_public_reference
    ),
    'sent',
    now()
  );

  return jsonb_build_object(
    'quoteRequestId', target_quote_id,
    'projectId', target_project_id,
    'projectReference', target_public_reference,
    'threadId', target_thread_id,
    'status', 'submitted',
    'idempotent', false
  );
end;
$$;

revoke all on function public.submit_customization_quote(
  text, text, text, integer, date, uuid, text, text, text, text, bigint, text, text,
  text, text, text, bigint, text
) from public, anon;

grant execute on function public.submit_customization_quote(
  text, text, text, integer, date, uuid, text, text, text, text, bigint, text, text,
  text, text, text, bigint, text
) to authenticated;
