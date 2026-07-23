insert into storage.buckets(
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-media',
  'product-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_media_storage_member_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] ~ '^[0-9]+$'
  and catalog.has_maker_role(((storage.foldername(name))[1])::bigint)
);

create policy product_media_storage_member_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] ~ '^[0-9]+$'
  and catalog.has_maker_role(
    ((storage.foldername(name))[1])::bigint,
    array['owner', 'manager', 'catalog_editor']
  )
);

create policy product_media_storage_member_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] ~ '^[0-9]+$'
  and catalog.has_maker_role(
    ((storage.foldername(name))[1])::bigint,
    array['owner', 'manager', 'catalog_editor']
  )
)
with check (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] ~ '^[0-9]+$'
  and catalog.has_maker_role(
    ((storage.foldername(name))[1])::bigint,
    array['owner', 'manager', 'catalog_editor']
  )
);

create policy product_media_storage_member_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] ~ '^[0-9]+$'
  and catalog.has_maker_role(
    ((storage.foldername(name))[1])::bigint,
    array['owner', 'manager', 'catalog_editor']
  )
);
