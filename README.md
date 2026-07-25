# LOOMON

**Craft lives on.**

LOOMON is an agent-powered visual marketplace that brings Vietnamese craft to global buyers and settles commerce on Arc. Buyers browse a visual collection, use a commerce agent to narrow requirements, customize a product, then place a prepaid order through an Arc Testnet escrow flow. Sellers manage order progress through normalized commerce data.

Supabase is the commercial source of truth; Arc Testnet provides the programmable payment and proof layer.

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

The catalog and commerce demo work without environment variables. Supabase persistence, WalletConnect and production payment actions require credentials in `.env.local`.

## Implemented surfaces

- `/` - animated product landing page
- `/app` - discovery feed, search, category filters, agent and wallet selector
- `/app/products/[slug]` - normalized product details and custom order entry point
- `/app/seller/products/new` - seller upload and validation flow
- `/app/orders` - buyer/seller order management
- `/app/orders/[orderId]` - escrow-backed order detail and lifecycle actions
- `/api/agent/search` - bounded structured-catalog search adapter
- `/api/checkout/confirm` - server-side Arc escrow confirmation
- `/api/orders/[orderId]/escrow/confirm` - verified order lifecycle projection

## Architecture

- Next.js App Router + React + TypeScript
- Supabase Postgres migrations, RLS, seed data, FTS and vector-ready search documents
- RainbowKit + Wagmi + Viem for external wallets
- Gemini-backed personal agent and image-preview workflow through server-side routes
- Arc Testnet escrow pool contract with server-side receipt/event verification
- Vitest and Foundry coverage for normalized data, checkout, and contract behavior

Read [docs/LOOMON-SLIDE-BRIEF.md](docs/LOOMON-SLIDE-BRIEF.md), [docs/PLAN.md](docs/PLAN.md), [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md), [codex.md](codex.md), and the mandatory design source in [design.md/DESIGN.md](design.md/DESIGN.md).

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Contract tests:

```bash
forge test
```
