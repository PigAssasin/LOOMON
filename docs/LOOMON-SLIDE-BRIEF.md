# LOOMON - Project Brief for Slides

Last updated: 2026-07-25

This document is a presentation source for LOOMON. It does not include private keys, service-role credentials, personal email, private database values, or internal `.env.local` content.

## 1. One-line Summary

LOOMON is an agent-powered custom souvenir commerce app that helps global buyers discover Vietnamese craft products, personalize them with AI previews, place prepaid orders on Arc Testnet, and receive an on-chain proof when the order is completed.

## 2. Short Pitch

Vietnam has many traditional craft workshops with strong cultural value, but the online buying experience is often fragmented: product discovery, customization, seller communication, payment, and order proof live in separate places.

LOOMON turns that journey into one simple web app. A buyer can browse visual products, ask a personal AI assistant for help, choose a souvenir, upload artwork or text, generate product previews, place an order through an Arc-based payment flow, and track the order in one place.

Behind the simple interface, LOOMON uses Supabase for normalized commerce data, Gemini for AI assistance and image-rendering workflows, and Arc Testnet smart contracts for prepaid escrow-style settlement and order proof.

## 3. Product Vision

LOOMON is built around one idea: high-quality Vietnamese craft should be easier to discover, customize, verify, and bring into modern commerce.

The first version is intentionally a demo marketplace instead of a full public marketplace. It focuses on showing the future direction:

- a visual discovery feed inspired by Pinterest-style browsing;
- custom souvenir ordering;
- an AI assistant that understands page and order context;
- a real database foundation for buyers, sellers, products, chats, customization, orders, and payments;
- Arc Testnet payment and order proof flows;
- a seller-side order-management path;
- a future-ready model for agent-controlled commerce actions.

## 4. Target Users

Buyers want a simple way to find a meaningful souvenir, personalize it, and know what is happening after they order.

Sellers and makers want a cleaner way to present products, receive custom requests, communicate with buyers, and manage orders without needing to understand crypto.

Agents act as operational assistants. The agent can search products, summarize order status, draft messages, explain next steps, guide customization, prepare order actions, and eventually manage payment or cancellation through tightly scoped permissions.

## 5. Problem

Traditional craft commerce has several common issues:

- product data is inconsistent and hard for AI to search;
- customization requests are often vague and scattered across chat messages;
- buyers need many back-and-forth messages before placing an order;
- sellers lack a structured order-management surface;
- payments and trust signals are weak for cross-border buyers;
- proof of purchase and product provenance are usually not portable;
- AI assistants often behave like generic chatbots instead of real workflow assistants.

LOOMON addresses these issues by combining structured product data, contextual AI, and Arc-based payment/proof infrastructure.

## 6. Current Demo Scope

The current product is a demo experience for custom Vietnamese souvenirs.

Implemented focus:

- public landing page;
- visual app feed;
- product detail and full-screen product view;
- custom order brief flow;
- AI-assisted customization preview path;
- personal AI assistant entry point;
- buyer/seller order views;
- profile and seller/store pages;
- seller product upload and product lifecycle planning;
- Supabase-backed schema and server APIs for real data;
- Arc Testnet escrow pool contract;
- order proof NFT design and planning;
- production deployment on Vercel.

The current demo uses one canonical seller shop for all demo products, so the ordering flow can be tested cleanly. Other connected wallets are treated as buyers.

## 7. Name Meaning

LOOMON combines the feeling of craft, weaving, loops, and on-chain continuity.

The name is short, global, and modern, while still carrying the idea of traditional making. It suggests a loop between maker, buyer, product, story, payment, and proof.

## 8. Core Buyer Flow

1. Browse products visually.
2. Open a product or ask the personal AI assistant for recommendations.
3. Choose a product.
4. Select "custom with agent".
5. Add quantity, notes, optional needed-by date, and optional image/artwork.
6. Either generate AI previews or send the brief without AI rendering.
7. Place order.
8. Sign the Arc Testnet transaction.
9. Track the order in the Orders page.
10. When the seller completes the demo order and the buyer confirms completion, an order proof NFT can be minted.

The key design goal is that the buyer does not need to understand Web3 infrastructure. The app should feel like a normal Web2 commerce app, while Arc works behind the scenes.

## 9. Seller Flow

1. Connect wallet and access the seller/store profile.
2. Manage listed products.
3. Receive buyer orders and custom briefs.
4. Review quantity, note, customization asset, and payment status.
5. Start production or refund where allowed.
6. Mark the order as delivered.
7. Claim funds only after the required completion and hold flow.

For the demo, all products are assigned to the single Lo May seller shop. This simplifies testing and proves one complete commercial path before expanding to multiple sellers.

## 10. Agent Role

LOOMON treats the agent as a real commerce assistant, not just a floating chatbot.

The agent should help with:

- product discovery;
- product comparison;
- customization guidance;
- order status explanation;
- message drafting;
- translation;
- reminders;
- refund and cancel guidance;
- structured order creation from natural language;
- future wallet delegation and payment execution under clear user-approved rules.

Important safety boundary:

The agent can draft, summarize, translate, and prepare actions, but it must not send buyer/seller messages or execute sensitive actions without permission. The model never receives private keys or arbitrary contract access. It produces typed intents, and deterministic server logic validates what can actually happen.

## 11. AI Customization Flow

The customization experience supports two paths.

AI preview path:

- user uploads an image, logo, reference, or text idea;
- the app combines the uploaded asset with the selected product image;
- Gemini image generation creates a limited number of product previews;
- the buyer selects the preferred preview;
- the preview becomes part of the order brief.

Manual/reference path:

- user does not need AI rendering;
- user can send notes, text, or an uploaded reference directly to the maker;
- the seller handles the final design discussion.

This is important because not every custom order should force AI generation. Some buyers only need to send a logo, a short text, or a rough reference.

## 12. Data Strategy

LOOMON uses Supabase as the structured source of truth.

The database is planned and implemented around normalized business domains:

- identity and wallet-linked profiles;
- maker/store records;
- product catalog;
- product versions;
- product media;
- product status and availability;
- customization projects;
- generated previews;
- buyer orders;
- seller order actions;
- buyer-seller chat;
- personal agent chat history;
- payment intents;
- on-chain transaction records;
- order proof records;
- audit and lifecycle history.

This matters because the agent needs clean, stable data. A generic chatbot can only guess; LOOMON's agent should retrieve product facts, order status, payment status, seller details, and user context from structured tables.

## 13. Product Data Principles

Product data is designed to be agent-friendly from the beginning.

Key principles:

- product facts are normalized;
- money is stored in atomic units, not floating-point values;
- products can be draft, active, paused, out of stock, archived, or deleted when still safe to delete;
- historical orders reference exact product snapshots;
- search data can be rebuilt from canonical product records;
- private user data is excluded from public search documents;
- seller-private notes and buyer-private messages do not leak into AI search embeddings;
- product media is handled separately from product facts.

This foundation makes future marketplace expansion much easier.

## 14. Blockchain and Arc Role

Arc is used to demonstrate programmable commerce infrastructure.

Current Arc role:

- Arc Testnet payment flow;
- USDC-style prepaid order settlement;
- escrow pool contract;
- order lifecycle events;
- future order proof NFT after successful completion;
- future agent wallet delegation.

The payment model is designed so the buyer can place an order upfront. Funds are held through the contract flow. The seller can start production, refund, mark delivery, and later claim according to the lifecycle rules.

For the demo, the most important message is not "crypto checkout". The message is:

Traditional craft commerce can become programmable, agent-assisted, and verifiable without making the user experience complicated.

## 15. Escrow Lifecycle

1. Buyer places order and funds escrow.
2. Order is recorded in Supabase after server verification.
3. Seller starts production.
4. Seller marks delivered.
5. Buyer confirms completion.
6. A completion hold begins.
7. Seller can claim funds after the hold.
8. If needed, refund or dispute paths can stop the normal flow.
9. Order proof NFT is minted only after successful completion.

This protects the demo narrative:

- payment happens on Arc;
- order state remains understandable in the web app;
- seller does not receive funds immediately;
- final proof is tied to completion, not just checkout.

## 16. Order Proof NFT

The order proof NFT is designed as a non-sensitive proof of completed purchase.

It should represent:

- order completion;
- product reference;
- maker/store identity;
- timestamp or order proof metadata;
- buyer ownership on Arc.

It should not expose:

- private address;
- email;
- private notes;
- full chat;
- private uploaded artwork;
- private delivery information.

In the app, the NFT appears in the buyer's purchased/proof area as a visible record of a successful order.

## 17. Security and Privacy Model

LOOMON separates public, private, and server-only data.

Key rules:

- private keys are never committed;
- service-role database keys stay server-only;
- Gemini API keys stay server-only;
- wallet signing is user-approved;
- the model never receives raw signing material;
- Supabase RLS and server routes protect buyer/seller boundaries;
- public product search excludes private chats, notes, addresses, and credentials;
- order state transitions are verified instead of trusting client messages;
- sensitive actions require permission, typed intent, and audit logs.

## 18. Technical Stack

Frontend:

- Next.js App Router;
- React;
- TypeScript;
- custom dark editorial design system;
- visual feed, product pages, profile, seller/store, order views, and agent surface.

Backend and data:

- Supabase Postgres;
- server-side Next.js API routes;
- normalized migrations;
- RLS and server-only actions;
- structured order/payment projection.

AI:

- Gemini text model for personal assistant behavior;
- Gemini image model for product preview rendering;
- server-side provider abstraction so the image model can change later.

Blockchain:

- Arc Testnet;
- Viem/Wagmi wallet interaction;
- escrow pool smart contract;
- contract tests with Foundry;
- future order proof NFT.

Deployment:

- GitHub repository;
- Vercel production deployment;
- environment secrets configured outside the repository.

## 19. What Makes LOOMON Different

LOOMON is not only a marketplace UI.

It combines four layers:

- cultural commerce: Vietnamese craft products and makers;
- AI assistance: discovery, customization, order support, chat, reminders;
- structured commerce data: normalized products, orders, chats, payments, lifecycle;
- Arc infrastructure: programmable payment, escrow, proof, and future agent wallets.

The user sees a simple app. Underneath, the system is prepared for real agent-powered commerce.

## 20. Demo Script for Presentation

1. Open the landing page.
2. Enter the app.
3. Browse the visual feed.
4. Search or ask the personal agent for a suitable product.
5. Open a product.
6. Start customization with agent.
7. Enter quantity, note, optional date, and upload a logo/reference.
8. Show AI preview option or reference-only order path.
9. Place an order through the Arc wallet flow.
10. Open Orders and show buyer/seller order management.
11. Explain seller delivery and buyer completion.
12. Show the concept of the final order proof NFT.

## 21. Current Implementation Status

Completed or substantially implemented:

- frontend demo experience;
- landing/app split;
- visual product browsing direction;
- product detail and custom order entry;
- personal agent concept and chat direction;
- AI render workflow planning and integration direction;
- Supabase normalized foundation;
- seller/buyer order model direction;
- buyer-seller chat direction;
- product lifecycle plan including pause, out of stock, archive, and delete draft;
- Arc Testnet escrow pool contract;
- contract and application tests;
- Vercel production deployment;
- GitHub push.

Still planned or being hardened:

- full multi-seller marketplace onboarding;
- production-grade email reminders;
- richer seller dashboard;
- dispute UX;
- production NFT gallery;
- deeper autonomous agent wallet permissions;
- larger product catalog;
- final E2E wallet testing with competition demo accounts.

## 22. Competition Message

LOOMON demonstrates how Arc can support a new generation of commerce apps: not a crypto app that asks users to learn blockchain first, but a normal-looking product experience where blockchain quietly adds programmable payment, trust, proof, and agent automation.

The project uses Vietnamese craft as the first category because craft products naturally need story, customization, seller communication, trust, and provenance. That makes LOOMON a strong testbed for agent-assisted commerce on Arc.

## 23. Suggested Slide Structure

1. Title: LOOMON
2. Problem: traditional craft commerce is fragmented
3. Vision: custom Vietnamese souvenirs powered by AI and Arc
4. User Flow: browse, customize, pay, track, prove
5. Agent: personal commerce assistant
6. AI Customization: upload, render previews, or send reference
7. Data Foundation: Supabase normalized commerce system
8. Arc Layer: prepaid escrow and future proof NFT
9. Buyer/Seller Experience: simple Web2 feel
10. Technical Architecture: Next.js, Supabase, Gemini, Arc, Vercel
11. Demo Walkthrough
12. Roadmap: multi-seller marketplace, agent wallet, production proof system

## 24. Public Links to Include

- Live app: https://loomon.vercel.app
- GitHub repository: https://github.com/PigAssasin/LOOMON

Do not include private keys, Supabase service-role keys, Gemini keys, wallet seed phrases, private user data, or internal `.env.local` content in the presentation.
