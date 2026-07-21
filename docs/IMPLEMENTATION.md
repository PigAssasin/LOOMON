# Implementation status — no-contract MVP

Updated: 2026-07-21

## Delivered

- Responsive web app using the locked `design.md` source.
- Separate animated marketing landing at `/` and marketplace application at `/app`.
- GSAP hero reveal, scroll progress, image parallax, section reveals, organic-shape parallax and continuous marquee with reduced-motion support.
- Twenty-four normalized product records and a Pinterest-style catalog.
- Product details with MOQ, lead time, material, finish and customization data.
- Buyer agent flow: search → feasible choices → requirements → estimate → deposit invoice → simulated paid state → follow-up.
- Seller studio with six steps, media staging and publication validation.
- Supabase schemas for catalog versioning, controlled vocabularies, provenance, imports, quotes, invoices, orders, payments, wallet delegation, agent tools and reminders.
- RLS, least-privilege grants, publication function, FTS/vector-ready documents and seed fixtures.
- RainbowKit external-wallet selection on Arc Testnet.
- Server-side verifier for direct USDC `Transfer` logs on Arc Testnet.
- Desktop/mobile browser QA for catalog, product, agent, seller, order and wallet flows.
- Dedicated collection banners and normalized collection membership in the discovery feed.
- Frontend freeze review recorded in `docs/FRONTEND_FREEZE.md`.

## Runtime modes

1. **Local demo:** fixture catalog and simulated payment; no credentials required.
2. **Supabase-connected:** configure public URL/key, then apply migrations and seed.
3. **Wallet-connected:** add a WalletConnect project ID.
4. **Production Arc Wallet:** connect Circle credentials and replace the demo payment trigger with signing plus `/api/payments/verify` confirmation.

## Intentional boundaries

- No custom smart contract, escrow or marketplace custody.
- Agent actions remain bounded by tool policies and wallet delegation records.
- No real funds move in the local demo.
- Payment status becomes authoritative only after server-side Arc receipt verification.

## Dependency note

`npm audit` reports transitive advisories in the current Next.js and WalletConnect connector trees, including one high-severity `ws` advisory. Automatic remediation requires breaking major-version changes, so `npm audit fix --force` was not used. Re-evaluate and upgrade the wallet stack before production deployment.
