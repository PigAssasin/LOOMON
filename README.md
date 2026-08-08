# LOOMON

LOOMON is a custom souvenir commerce demo for Vietnamese ceramic craft, powered by an app-native agent and settled through Arc Testnet.

It starts like a simple Web2 shopping experience: browse beautiful products, choose a piece, upload artwork or text, preview the custom result, and place an order. Behind that calm surface, LOOMON uses wallets, Arc escrow, seller actions, order chat, and proof NFTs to show how traditional craft can move into a more trusted digital commerce flow.

Live demo:

- [Landing page](https://loomon.vercel.app)
- [App](https://loomon.vercel.app/app)
- [Docs](https://loomon.vercel.app/app/docs)

## Quick architecture

```text
Buyer wallet
  -> Next.js app
  -> Supabase wallet session
  -> Custom brief + checkout session
  -> Arc escrow transaction
  -> Server receipt/event verification
  -> Supabase order projection
  -> Seller actions + order chat + proof record
```

## Why LOOMON exists

Traditional products often carry stories: a kiln, a workshop, a maker, a material, a region, a memory. But online commerce usually flattens that into a product card and a checkout button.

LOOMON explores a different direction:

- make craft goods easy to discover;
- let buyers personalize souvenirs without learning Web3;
- give sellers clear production briefs instead of scattered messages;
- use Arc for payment trust and verifiable order milestones;
- use an agent as a practical helper, not a gimmick.

The goal is not to make users "use blockchain". The goal is to let them buy, customize, talk, and receive proof naturally while Arc works quietly underneath.

## What the demo shows

### Buyer experience

Buyers can:

1. browse a Pinterest-style ceramic catalog;
2. open a product;
3. customize with optional uploaded artwork, printed text, notes, quantity, and receive date;
4. optionally generate AI previews of the artwork applied to the product;
5. place an Arc testnet order;
6. track the order in Buying;
7. chat with the seller;
8. receive a proof NFT after successful delivery.

### Seller experience

The demo seller can:

1. see incoming paid orders;
2. open each order and view the full production brief;
3. see the buyer's original uploaded image and selected custom preview;
4. accept, reject/refund, mark delivered, or cancel/refund according to the order stage;
5. chat with the buyer;
6. review completed order history.

### Agent experience

The LOOMON agent is designed as a personal commerce assistant:

- helps users find suitable products;
- explains order status;
- summarizes buyer/seller messages;
- drafts messages for the user to send;
- guides wallet actions without secretly signing for the user;
- keeps context from the page the user is currently viewing.

The agent is powerful, but intentionally bounded. It can help prepare actions, but final product choice, payments, and messages remain user-controlled.

## How Arc fits in

LOOMON uses Arc to demonstrate a trust layer for custom commerce:

- buyer payment goes into an Arc testnet escrow flow;
- seller acceptance, refund, delivery, and buyer completion are wallet-signed actions;
- after completion, an order proof NFT can represent that the custom purchase happened;
- Supabase keeps the app data: products, profiles, chat, custom briefs, and order projections.

In plain language: the app feels simple, while Arc records the important commerce milestones.

## Arc Testnet contract registry

Public testnet addresses used by the demo:

| Component | Address / config | Purpose |
| --- | --- | --- |
| Arc Testnet | `chainId 5042002` | Target network for wallet actions |
| Arc native USDC | `0x3600000000000000000000000000000000000000` | Payment asset |
| `LoomonNativeEscrowPool` | `0x95d242919da239859ca7ab8eddc77ae5b4f450db` | Active prepaid order escrow |
| `LoomonQuoteDecision` | `0x0af0d368ed7a742f623103FDf9e43a193f330380` | Demo seller accept/reject registry |
| `LoomonOrderProof` | `LOOMON_ORDER_PROOF_ADDRESS` env | Non-transferable proof NFT |

Secrets such as deployer keys, minter keys, Supabase service-role keys, and API keys are intentionally not in the repository.

## Core demo flow

```text
Discover product
   -> Customize with artwork/text
   -> Optional AI preview
   -> Place Arc order
   -> Seller reviews full brief
   -> Seller accepts or refunds
   -> Buyer and seller chat
   -> Seller marks delivered
   -> Buyer confirms and receives proof NFT
```

## Current scope

LOOMON is a hackathon/demo build. It focuses on ceramic souvenir products and one controlled seller workspace so the full buyer/seller/on-chain lifecycle can be tested clearly.

Implemented demo areas:

- ceramic product discovery;
- custom order flow;
- AI product preview generation;
- buyer/seller order center;
- seller production brief detail;
- order-scoped chat with images and emoji;
- Arc testnet order actions;
- proof NFT records;
- profile and purchased proof surfaces;
- project docs page.

## Tech, briefly

LOOMON uses:

- Next.js and React for the web app;
- Supabase for product, order, chat, profile, and asset data;
- Arc testnet contracts for escrow and proof flows;
- Wagmi/RainbowKit/Viem for wallet interaction;
- Gemini for agent and image-preview capabilities;
- Vercel for deployment.

The stack matters less than the product idea: a familiar shopping app that can quietly coordinate agent assistance, seller operations, and verifiable payment milestones.

## Local setup

Create a local env file:

```bash
cp .env.example .env.local
```

Fill only your own local values. Never commit `.env.local`, API keys, service-role keys, or private keys.

Install and run:

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## Security and privacy notes

- Secrets are intentionally kept out of the repository.
- `.env`, `.env.local`, Vercel metadata, build outputs, logs, and contract broadcast artifacts are ignored.
- Server-only keys should stay in local/Vercel environment variables.
- The public `.env.example` contains variable names only, not real credentials.
- The agent does not automatically send buyer/seller messages without user approval.
- Wallet-signed actions remain explicit user actions.
- Order images and custom briefs are scoped to the buyer and seller of that order.
- Arc projections verify receipts, transaction sender, target contract, event name, and order id before writing order status.
- See [SECURITY.md](SECURITY.md) for the repository security policy.

## Repository guide

- `app/` - Next.js app routes and API endpoints
- `src/features/` - main product experiences: discovery, orders, profile, agent, customization
- `src/domain/` - domain rules and typed app models
- `supabase/migrations/` - database schema and business logic
- `contracts/` - Arc testnet smart contract code and tests
- `docs/` - execution plans, architecture notes, and demo documentation
- `public/images/` - demo product and landing assets

## Project docs

- [LOOMON slide brief](docs/LOOMON-SLIDE-BRIEF.md)
- [Demo polish execution plan](docs/LOOMON-DEMO-POLISH-EXECUTION-PLAN.md)
- [Implementation notes](docs/IMPLEMENTATION.md)
- [Project rules](codex.md)

## Status

LOOMON is under active development as a product demo. The current version is intended to communicate the experience: a modern custom souvenir app where Vietnamese craft, agent assistance, and Arc-powered trust meet in one smooth flow.
