-- LOOMON demo policy: every listed product belongs to one seller, Lò Mây.
-- The deployer wallet is the only active seller identity; all other wallets
-- remain buyer-only.

do $$
declare
  lo_may_id bigint;
  seller_account_id uuid;
  seller_user_id uuid;
begin
  select id into lo_may_id
  from catalog.makers
  where slug = 'lo-may'
  for update;
  if lo_may_id is null then raise exception 'lo_may_maker_not_found'; end if;

  select id, user_id into seller_account_id, seller_user_id
  from wallet.accounts
  where chain_id = 5042002
    and lower(address) = '0xd59aa8db407d4219fe4b104ca4142df14301dec4'
    and verified_at is not null
  order by is_primary desc, created_at
  limit 1;
  if seller_account_id is null then
    raise exception 'single_seller_wallet_not_verified';
  end if;

  update catalog.makers
  set
    display_name = 'Lò Mây',
    verification_status = 'verified',
    updated_at = now()
  where id = lo_may_id;

  update catalog.products
  set maker_id = lo_may_id, updated_at = now()
  where maker_id <> lo_may_id;

  update catalog.maker_memberships
  set status = 'revoked', updated_at = now()
  where status = 'active'
    and not (maker_id = lo_may_id and user_id = seller_user_id);

  insert into catalog.maker_memberships(
    maker_id, user_id, role, status
  )
  values (lo_may_id, seller_user_id, 'owner', 'active')
  on conflict (maker_id, user_id) do update
  set role = 'owner', status = 'active', updated_at = now();

  update payments.maker_payout_destinations
  set revoked_at = coalesce(revoked_at, now())
  where revoked_at is null;

  insert into payments.maker_payout_destinations(
    maker_id, wallet_account_id, created_by_user_id, activated_at, revoked_at
  )
  values (lo_may_id, seller_account_id, seller_user_id, now(), null)
  on conflict (maker_id, wallet_account_id) do update
  set
    created_by_user_id = excluded.created_by_user_id,
    activated_at = now(),
    revoked_at = null;
end;
$$;

alter table commerce.checkout_sessions
  drop constraint if exists checkout_buyer_seller_different;

alter table commerce.checkout_sessions
  add constraint checkout_buyer_seller_different
  check (lower(buyer_address) <> lower(seller_address));

create or replace function public.list_claimable_demo_makers()
returns table(id bigint, slug text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select maker.id, maker.slug, maker.display_name
  from catalog.makers maker
  where false;
$$;

create or replace function public.claim_demo_maker(p_maker_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'single_demo_seller_only' using errcode = '42501';
end;
$$;

revoke all on function public.list_claimable_demo_makers() from public, anon;
grant execute on function public.list_claimable_demo_makers() to authenticated;
revoke all on function public.claim_demo_maker(bigint) from public, anon;
grant execute on function public.claim_demo_maker(bigint) to authenticated;
