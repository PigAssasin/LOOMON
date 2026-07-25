-- Canonicalize the single seller to the deterministic signed-wallet Auth user.
-- Earlier Web3 experiments could leave more than one auth user carrying the
-- same testnet address; seller permissions must point to the user returned by
-- the production wallet-session bridge.

do $$
declare
  lo_may_id bigint;
  canonical_user_id uuid;
  canonical_account_id uuid;
begin
  select id into lo_may_id
  from catalog.makers
  where slug = 'lo-may'
  for update;

  select id into canonical_user_id
  from auth.users
  where lower(email) =
    'arc-d59aa8db407d4219fe4b104ca4142df14301dec4@wallet.loomon.invalid'
  limit 1;
  if canonical_user_id is null then
    raise exception 'canonical_seller_user_not_found';
  end if;

  select id into canonical_account_id
  from wallet.accounts
  where user_id = canonical_user_id
    and chain_id = 5042002
    and lower(address) = '0xd59aa8db407d4219fe4b104ca4142df14301dec4'
  order by verified_at desc nulls last, created_at
  limit 1;

  if canonical_account_id is null then
    update wallet.accounts
    set is_primary = false
    where user_id = canonical_user_id and is_primary;

    insert into wallet.accounts(
      user_id, provider, wallet_type, custody_type, chain_id, address,
      is_primary, verified_at
    )
    values (
      canonical_user_id, 'loomon_wallet', 'external', 'user_controlled',
      5042002, '0xd59aa8db407d4219fe4b104ca4142df14301dec4',
      true, now()
    )
    returning id into canonical_account_id;
  end if;

  update catalog.maker_memberships
  set status = 'revoked', updated_at = now()
  where status = 'active';

  insert into catalog.maker_memberships(maker_id, user_id, role, status)
  values (lo_may_id, canonical_user_id, 'owner', 'active')
  on conflict (maker_id, user_id) do update
  set role = 'owner', status = 'active', updated_at = now();

  update payments.maker_payout_destinations
  set revoked_at = coalesce(revoked_at, now())
  where revoked_at is null;

  insert into payments.maker_payout_destinations(
    maker_id, wallet_account_id, created_by_user_id, activated_at, revoked_at
  )
  values (
    lo_may_id, canonical_account_id, canonical_user_id, now(), null
  )
  on conflict (maker_id, wallet_account_id) do update
  set
    created_by_user_id = canonical_user_id,
    activated_at = now(),
    revoked_at = null;
end;
$$;
