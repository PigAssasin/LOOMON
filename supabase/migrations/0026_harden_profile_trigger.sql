-- The profile bootstrap function is invoked only by the auth.users trigger.
-- Browser roles must never be able to call this SECURITY DEFINER function
-- directly with arbitrary user identifiers.
revoke all on function public.handle_new_profile() from public;
revoke all on function public.handle_new_profile() from anon;
revoke all on function public.handle_new_profile() from authenticated;
