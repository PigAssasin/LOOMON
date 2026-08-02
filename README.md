# LOOMON

Agent-powered custom souvenir commerce for Vietnamese ceramics, settled on Arc.

LOOMON is a hackathon demo that turns traditional craft shopping into a simple web app flow: browse curated ceramic products, customize with image/text, pay into Arc testnet escrow, let the seller manage fulfillment, then mint an on-chain proof NFT after successful delivery.

## Live links

- Landing: [https://loomon.vercel.app](https://loomon.vercel.app)
- App: [https://loomon.vercel.app/app](https://loomon.vercel.app/app)
- Docs: [https://loomon.vercel.app/docs](https://loomon.vercel.app/docs)

## What the demo shows

- Pinterest-style product discovery for Vietnamese ceramic souvenirs.
- A single demo seller, Lò Mây, used to test the buyer/seller order lifecycle.
- Optional AI preview rendering using the product reference image plus user artwork/text.
- Arc testnet prepaid escrow for real wallet-signed order actions.
- Buyer/seller order center with Incoming, Active and History stages.
- Order-scoped buyer/seller chat with text, emoji and image attachments.
- Proof NFT records for completed orders, with Arc explorer links.
- A constrained Personal Agent that can read app context, search products, summarize order state and prepare safe user actions.

## Buyer flow

1. Browse the app or ask the Personal Agent for product suggestions.
2. Open a product and click `Customize with agent`.
3. Optionally upload artwork, add printed text, describe placement and render three previews.
4. Place the order by signing the Arc escrow transaction.
5. The order appears in Buying → Requests while waiting for seller acceptance.
6. After seller acceptance, the order moves to Buying → Active.
7. When the seller marks it delivered, the buyer can mint the proof NFT.
8. Completed orders and proof transactions appear in History and Profile/Purchased.

## Seller flow

1. Connect the Lò Mây demo seller wallet.
2. Open Orders → Selling.
3. New paid orders appear in Incoming.
4. Accept moves the order to Active; reject refunds the buyer.
5. Active orders can be marked delivered or cancelled/refunded.
6. Delivered/completed orders move into History with proof links when available.

## Arc on-chain scope

- Order placement funds the LOOMON escrow pool on Arc testnet.
- Seller acceptance, rejection/refund, delivery and buyer completion are wallet-signed actions.
- Completion triggers proof NFT minting/indexing for the order.
- Supabase stores off-chain product, chat, profile and projection data; Arc is the source of truth for escrow/proof actions.

## Tech stack

- Next.js App Router, React, TypeScript
- Supabase Postgres, RLS-oriented schema and server routes
- Arc testnet, Viem, Wagmi, RainbowKit
- Foundry smart contracts
- Gemini text and image generation APIs

## Environment

Copy `.env.example` to `.env.local` and fill local-only values. Never commit `.env.local` or private keys.

Required public/server variables are documented in `.env.example`.

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Security notes

- No private keys or service-role secrets should be committed.
- Agent actions are constrained: the agent can draft, summarize and guide, but the user signs wallet transactions and manually sends buyer/seller messages.
- Image/chat APIs validate order access by connected buyer/seller wallet before returning order-scoped data.

## Project docs

- [Demo polish execution plan](docs/LOOMON-DEMO-POLISH-EXECUTION-PLAN.md)
- [Slide brief](docs/LOOMON-SLIDE-BRIEF.md)
- [Implementation notes](docs/IMPLEMENTATION.md)
- [Project rules](codex.md)
