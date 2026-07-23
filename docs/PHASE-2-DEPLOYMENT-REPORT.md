# LOOMON Phase 2 deployment report

Updated: 2026-07-23

## Supabase production

- Project: `LOOMON`
- Project ref: `tmrmvdqtkuoxforqulid`
- Region: Singapore (`ap-southeast-1`)
- Cost reported by Supabase at creation: `0 USD/month`
- Status at creation: `ACTIVE_HEALTHY`
- API URL: `https://tmrmvdqtkuoxforqulid.supabase.co`

Applied migrations:

1. `catalog_foundation`
2. `commerce_agent_wallet`
3. `search_and_publication`
4. `rls_and_privileges`
5. `order_references_and_email_reminders`
6. `agent_commerce_flow`
7. `performance_hardening`
8. `seed_utf8_repair`

Production verification:

- 59 application tables have RLS enabled.
- Supabase Security Advisor: 0 findings.
- Supabase Performance Advisor: 0 warning/error findings.
- Remaining performance notices are unused-index informational notices expected on a new database with no traffic.
- pgTAP agent-commerce schema suite: 30 assertions passed.
- Seed result: 6 makers, 24 published products and 24 search documents.
- UTF-8 was verified from stored byte sequences for Vietnamese maker and category names.
- Public REST smoke test for `published_products`: HTTP 200.
- Search RPC smoke test returned matching products with USDC prices.

Local/Vercel configuration:

- `NEXT_PUBLIC_SUPABASE_URL` is set in local `.env.local` and Vercel Production.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is set in local `.env.local` and Vercel Production.
- No service-role key or wallet private key is present in Vercel.

## Arc contract

Contract source and tests are present under `contracts/`.

Verification:

- `forge fmt --check`: passed.
- `forge test --no-cache -vvv`: 6 passed, 0 failed.

Deployment is pending one local-only secret:

- `ARC_DEPLOYER_PRIVATE_KEY` must be added by the owner to `.env.local`.
- The deploy command must read it without printing it.
- The key must never be committed, logged, uploaded to Vercel or copied into documentation.
- For the testnet MVP, the deployer address may also act as the resolver.

After the key is available:

1. Derive the deployer/resolver public address locally.
2. Verify Arc Testnet balance.
3. Deploy `LoomonEscrowFactory`.
4. Record address, transaction hash, block and chain ID in `contracts/deployments/arc-testnet.json`.
5. Register the contract in `payments.contract_versions`.
6. Run create/accept/fund/release/cancel/dispute smoke tests where test funds allow.
7. Add only the public factory address and chain configuration to Vercel.
8. Redeploy production and run final web/API checks.

## Current checkpoint

The Supabase production database is real and operational. The contract is tested but not yet deployed. Production web redeployment is intentionally held until the contract address is available so the final deployment contains one consistent database-and-contract configuration.
