# LOOMON — Craft lives on.

> **Agent-Powered Custom Souvenir Commerce, Settled on Arc**

LOOMON is a visual commerce app connecting global buyers with traditional Vietnamese craft workshops. Powered by a contextual AI Agent and settled on Arc Testnet, LOOMON turns a fragmented craft shopping experience into a seamless journey: from discovery and custom preview generation to escrow-backed settlement and on-chain order proof.

---

## 🌟 Overview & Hackathon Vision

Traditional craft commerce suffers from scattered communication, vague customization requirements, fragmented payments, and a lack of verifiable proof of purchase.

LOOMON solves these problems by combining:
1. **Pinterest-Style Visual Discovery**: A curated feed of authentic Vietnamese craft products.
2. **Contextual AI Commerce Agent**: Powered by Gemini, assisting buyers with recommendations, customization previews, and order tracking.
3. **Programmable Arc Settlement**: Secure USDC prepaid escrow smart contracts on Arc Testnet (`LoomonEscrow.sol`).
4. **On-Chain Order Proof**: Minting a non-transferable **Order Proof NFT** upon confirmed order completion.

---

## 🚀 Key Features

* 🎨 **Visual Discovery Feed**: Explore authentic artisan products with rich filters and responsive layouts.
* 🤖 **Personal Commerce Agent**: A unified AI assistant that understands page context, searches catalog data, and guides buyers through ordering.
* 🖼️ **AI Customization Studio**: Upload artwork, logos, or notes to generate realistic product previews (Gemini-backed) or submit a direct brief to the maker.
* 🔐 **Arc Testnet Escrow**: Escrow pool contracts ensure buyer funds are securely held until the order is delivered and confirmed.
* 📜 **Order Proof NFT**: Minted directly to the buyer's wallet as portable, tamper-proof evidence of purchase and completion.
* 📦 **Seller Management**: Dedicated dashboard for makers to accept orders, manage production milestones, and release escrow funds.

---

## 🛠️ Architecture

LOOMON keeps blockchain complexity hidden behind a modern Web2-like interface while utilizing Arc for transparent, programmable settlement.

* **Frontend**: Next.js (App Router), React, TypeScript, GSAP Animations, Custom Dark Editorial Design System.
* **Database & Backend**: Supabase Postgres (Normalized schema, Row Level Security, FTS & Vector-ready documents).
* **AI Engine**: Google Gemini API (Text model for assistant dialogue, Image model for preview rendering).
* **Blockchain & Web3**: Arc Testnet (Chain ID `5042002`), Viem / Wagmi / RainbowKit, Foundry (`LoomonEscrow.sol`).

---

## 🔄 Core User Flow

```
[ Visual Discovery ] ➔ [ Consult AI Agent ] ➔ [ Customize Design ] 
                                                      │
[ Order Proof NFT ] ⬅ [ Confirm Delivery ] ⬅ [ Arc Escrow Payment ]
```

1. **Discover**: Browse craft collections or ask the Personal Agent for recommendations.
2. **Customize**: Choose a product, upload reference assets, and generate AI preview candidates or send a maker brief.
3. **Pay & Escrow**: Approve order details and fund the Arc Testnet USDC escrow contract.
4. **Fulfill & Deliver**: The maker receives structured order specs and updates production milestones.
5. **Confirm & Prove**: Upon delivery confirmation, funds are released and an **Order Proof NFT** is minted to the buyer's wallet.

---

## ⛓️ Arc Testnet Smart Contracts

* **Chain ID**: `5042002`
* **RPC Endpoint**: `https://rpc.testnet.arc.network`
* **Explorer**: `https://testnet.arcscan.app`
* **USDC Token Interface**: `0x3600000000000000000000000000000000000000`

Smart contract code and Foundry tests reside in the [`contracts/`](contracts/) directory.

---

## 💻 Implemented App Surfaces

* `/` — Animated product landing page
* `/app` — Discovery feed, category filters, agent assistant, and wallet selector
* `/app/products/[slug]` — Product details & custom order entry
* `/app/seller/products/new` — Seller product upload & validation flow
* `/app/orders` — Buyer & seller order management dashboard
* `/app/orders/[orderId]` — Escrow-backed order detail & lifecycle actions
* `/api/agent/chat` — Contextual AI agent server endpoint
* `/api/checkout/confirm` — Arc escrow receipt & payment verification

---

## 🏃 Local Setup & Verification

### Prerequisites
* Node.js 18+
* Foundry (optional, for contract testing)

### Installation
```bash
# Clone the repository
git clone https://github.com/PigAssasin/LOOMON.git
cd LOOMON

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Start the development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### Verification & Testing
```bash
# Type checking & linting
npm run typecheck
npm run lint

# Application unit tests
npm test

# Smart contract tests (Foundry)
forge test
```

---

## 📄 Documentation

For deeper details into technical specifications and plans:
* [LOOMON Slide Brief](docs/LOOMON-SLIDE-BRIEF.md)
* [Master Build Plan](docs/PLAN.md)
* [Implementation Status](docs/IMPLEMENTATION.md)
* [Project Codex & Rules](codex.md)

---

## ⚖️ License & Hackathon Notice

Built for the **Arc Hackathon**. LOOMON demonstrates how Arc smart contracts and AI agents enable frictionless, trustless commerce for traditional crafts.
