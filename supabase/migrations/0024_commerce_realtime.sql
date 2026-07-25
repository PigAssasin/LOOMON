-- Keep buyer, seller, chat, profile and proof surfaces synchronized across sessions.
-- RLS continues to decide which change events each authenticated user may receive.

do $$
declare
  target record;
begin
  for target in
    select *
    from (
      values
        ('commerce', 'quote_requests'),
        ('commerce', 'orders'),
        ('commerce', 'order_proof_nfts'),
        ('messaging', 'messages'),
        ('public', 'profiles'),
        ('public', 'store_follows')
    ) as tables(schema_name, table_name)
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = target.schema_name
        and tablename = target.table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table %I.%I',
        target.schema_name,
        target.table_name
      );
    end if;
  end loop;
end;
$$;
