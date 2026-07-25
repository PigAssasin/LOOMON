-- Supabase reserves and rewrites app_metadata.provider to the OTP provider.
-- Use LOOMON's own server-only marker together with the verified address.

create or replace function public.sync_my_web3_wallet(p_address text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  account_record wallet.accounts%rowtype;
  app_metadata jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb);
  is_loomon_signature boolean := (
    app_metadata ->> 'wallet_verified_by' = 'loomon_signature'
    and lower(app_metadata ->> 'wallet_address') = lower(p_address)
  );
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_address !~ '^0x[0-9a-fA-F]{40}$' then
    raise exception 'invalid_wallet_address' using errcode = '22023';
  end if;
  if not (
    exists (
      select 1
      from auth.identities identity_record
      where identity_record.user_id = actor_id
        and lower(identity_record.identity_data::text) like
          ('%' || lower(p_address) || '%')
    )
    or is_loomon_signature
  ) then
    raise exception 'wallet_identity_mismatch' using errcode = '42501';
  end if;

  update wallet.accounts
  set is_primary = false
  where user_id = actor_id and is_primary;

  insert into wallet.accounts(
    user_id, provider, wallet_type, custody_type, chain_id, address,
    is_primary, verified_at
  )
  values (
    actor_id,
    case when is_loomon_signature then 'loomon_wallet' else 'supabase_web3' end,
    'external', 'user_controlled', 5042002,
    lower(p_address), true, now()
  )
  on conflict (user_id, chain_id, address) do update
  set
    provider = excluded.provider,
    is_primary = true,
    verified_at = now()
  returning * into account_record;

  return jsonb_build_object(
    'address', account_record.address,
    'chainId', account_record.chain_id,
    'verified', true
  );
end;
$$;

revoke all on function public.sync_my_web3_wallet(text) from public, anon;
grant execute on function public.sync_my_web3_wallet(text) to authenticated;
