# Pinterest Markers

Visual discovery marketplace for Vietnamese craft. Buyers browse a Pinterest-like collection, use a commerce agent to narrow requirements and prepare a quote, then place a direct USDC deposit on Arc. Sellers publish normalized product data through a guided studio.

This implementation deliberately uses **no custom smart contract**. Supabase is the commercial source of truth; Arc Testnet is the payment settlement rail.

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

The catalog and commerce demo work without environment variables. Supabase persistence, WalletConnect and production payment actions require credentials in `.env.local`.

## Implemented surfaces

- `/` — animated product landing page
- `/app` — discovery feed, search, category filters, agent and wallet selector
- `/app/products/[slug]` — normalized product details and quote entry point
- `/app/seller/products/new` — six-step seller upload and validation flow
- `/app/orders/demo-order` — agent-managed milestone and reminder timeline
- `/api/agent/search` — bounded structured-catalog search adapter
- `/api/payments/verify` — Arc Testnet USDC transfer receipt verifier

## Architecture

- Next.js App Router + React + TypeScript
- Supabase Postgres migrations, RLS, seed data, FTS and vector-ready search documents
- RainbowKit + Wagmi + Viem for external wallets
- Arc Wallet represented as a separate embedded-wallet UX adapter, ready for Circle credentials
- Direct USDC transfer verification on Arc Testnet; no escrow/custom contract
- Vitest for normalized-data and money conversion checks

Read [docs/PLAN.md](docs/PLAN.md), [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md), [codex.md](codex.md), and the mandatory design source in [design.md/DESIGN.md](design.md/DESIGN.md).

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Visual QA captures are stored in `docs/qa/`.
