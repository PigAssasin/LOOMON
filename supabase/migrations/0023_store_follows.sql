create table if not exists public.store_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  maker_id bigint not null references catalog.makers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, maker_id)
);

create index if not exists store_follows_maker_idx
  on public.store_follows(maker_id, created_at desc);

alter table public.store_follows enable row level security;

drop policy if exists store_follows_owner_select on public.store_follows;
create policy store_follows_owner_select
on public.store_follows for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists store_follows_owner_insert on public.store_follows;
create policy store_follows_owner_insert
on public.store_follows for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists store_follows_owner_delete on public.store_follows;
create policy store_follows_owner_delete
on public.store_follows for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, delete on public.store_follows to authenticated;

create or replace function public.list_my_followed_stores()
returns table(maker_slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select maker.slug
  from public.store_follows follow
  join catalog.makers maker on maker.id = follow.maker_id
  where follow.user_id = auth.uid()
  order by follow.created_at desc;
$$;

create or replace function public.toggle_store_follow(p_maker_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  maker_record catalog.makers%rowtype;
  now_following boolean;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into maker_record
  from catalog.makers
  where slug = lower(p_maker_slug)
    and verification_status <> 'suspended';
  if not found then raise exception 'maker_not_found'; end if;

  delete from public.store_follows
  where user_id = actor_id and maker_id = maker_record.id;

  if found then
    now_following := false;
  else
    insert into public.store_follows(user_id, maker_id)
    values (actor_id, maker_record.id);
    now_following := true;
  end if;

  return jsonb_build_object(
    'makerSlug', maker_record.slug,
    'following', now_following
  );
end;
$$;

revoke all on function public.list_my_followed_stores() from public, anon;
revoke all on function public.toggle_store_follow(text) from public, anon;
grant execute on function public.list_my_followed_stores() to authenticated;
grant execute on function public.toggle_store_follow(text) to authenticated;

