-- Read-only demo seller workspace for the single Lò Mây seller wallet.
-- This keeps the hackathon demo smooth: the seller can see incoming/active
-- orders after connecting the known wallet, while money-changing actions still
-- require Arc wallet transactions or authenticated server confirmation.

create or replace function public.get_single_demo_seller_workspace(p_wallet_address text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when lower(p_wallet_address) <> '0xd59aa8db407d4219fe4b104ca4142df14301dec4'
      then jsonb_build_object(
        'buyingRequests', '[]'::jsonb,
        'sellingRequests', '[]'::jsonb,
        'buyingOrders', '[]'::jsonb,
        'sellingOrders', '[]'::jsonb
      )
    else jsonb_build_object(
      'buyingRequests', '[]'::jsonb,
      'buyingOrders', '[]'::jsonb,
      'sellingRequests', coalesce((
        select jsonb_agg(row_data order by (row_data ->> 'updatedAt') desc)
        from (
          select jsonb_build_object(
            'kind', 'request',
            'id', request.id,
            'reference', request.public_reference,
            'status', request.status,
            'requiredBy', request.required_by,
            'note', request.buyer_note,
            'sellerNote', request.seller_response_note,
            'createdAt', request.created_at,
            'updatedAt', request.updated_at,
            'makerId', maker.id,
            'makerName', maker.display_name,
            'buyerName', coalesce(profile.display_name, 'Buyer'),
            'productId', product.id,
            'productSlug', product.slug,
            'productTitle', coalesce(localized.title, product.slug),
            'quantity', item.quantity,
            'threadId', thread.id
          ) as row_data
          from commerce.quote_requests request
          join catalog.makers maker on maker.id = request.maker_id
          join commerce.quote_request_items item on item.quote_request_id = request.id
          join catalog.products product on product.id = item.product_id
          left join public.profiles profile on profile.user_id = request.buyer_id
          left join catalog.product_localizations localized
            on localized.product_version_id = item.product_version_id
            and localized.locale = 'en'
          left join messaging.threads thread
            on thread.project_id = request.project_id
            and thread.thread_type = 'buyer_seller'
          where maker.slug = 'lo-may'
        ) selling_request_rows
      ), '[]'::jsonb),
      'sellingOrders', coalesce((
        select jsonb_agg(row_data order by (row_data ->> 'updatedAt') desc)
        from (
          select jsonb_build_object(
            'kind', 'order',
            'id', order_record.id,
            'reference', order_record.order_number,
            'status', order_record.status,
            'createdAt', order_record.created_at,
            'updatedAt', order_record.updated_at,
            'deliveredAt', order_record.seller_marked_delivered_at,
            'receivedAt', order_record.buyer_confirmed_received_at,
            'makerId', maker.id,
            'makerName', maker.display_name,
            'buyerName', coalesce(profile.display_name, 'Buyer'),
            'productId', product.id,
            'productSlug', product.slug,
            'productTitle', coalesce(localized.title, product.slug),
            'quantity', item.quantity,
            'threadId', thread.id
          ) as row_data
          from commerce.orders order_record
          join catalog.makers maker on maker.id = order_record.maker_id
          join commerce.quote_versions quote_version
            on quote_version.id = order_record.accepted_quote_version_id
          join commerce.quote_request_items item
            on item.quote_request_id = quote_version.quote_request_id
          join catalog.products product on product.id = item.product_id
          left join public.profiles profile on profile.user_id = order_record.buyer_id
          left join catalog.product_localizations localized
            on localized.product_version_id = item.product_version_id
            and localized.locale = 'en'
          left join messaging.threads thread on thread.order_id = order_record.id
          where maker.slug = 'lo-may'
        ) selling_order_rows
      ), '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.get_single_demo_seller_workspace(text) from public, anon, authenticated;
grant execute on function public.get_single_demo_seller_workspace(text) to service_role;
