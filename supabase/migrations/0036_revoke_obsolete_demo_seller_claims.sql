-- The single-seller demo no longer exposes self-service maker claiming.
-- Keep execution limited to trusted maintenance roles.

revoke all on function public.list_claimable_demo_makers() from public, anon, authenticated;
revoke all on function public.claim_demo_maker(bigint) from public, anon, authenticated;

grant execute on function public.list_claimable_demo_makers() to service_role;
grant execute on function public.claim_demo_maker(bigint) to service_role;
