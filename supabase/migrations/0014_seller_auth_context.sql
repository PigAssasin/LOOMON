create or replace function public.get_my_seller_memberships()
returns table (
  maker_id bigint,
  maker_slug text,
  maker_name text,
  membership_role text,
  membership_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.slug,
    m.display_name,
    mm.role,
    mm.status
  from catalog.maker_memberships mm
  join catalog.makers m on m.id = mm.maker_id
  where mm.user_id = (select auth.uid())
    and mm.status = 'active'
    and mm.role in ('owner', 'manager', 'catalog_editor')
  order by m.id
$$;

revoke all on function public.get_my_seller_memberships() from public, anon;
grant execute on function public.get_my_seller_memberships() to authenticated;

