-- The original payment-gated proof command predates buyer-confirmed delivery.
-- Remove it so every application mint must pass the delivered-order gate.

revoke all on function public.server_prepare_order_proof(
  uuid, text, text, text, uuid
) from public, anon, authenticated, service_role;

drop function public.server_prepare_order_proof(
  uuid, text, text, text, uuid
);
