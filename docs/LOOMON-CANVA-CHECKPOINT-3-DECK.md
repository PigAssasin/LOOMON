# LOOMON Canva Deck - Checkpoint 3

Use this as the clean slide source for Canva. Keep each slide visually simple: one strong sentence, one screenshot/product image, and 2-3 supporting bullets at most.

## Slide 1 - LOOMON

Agent-powered custom souvenir commerce for Vietnamese craft.

Subtitle:
Discover ceramics, customize with AI, pay through Arc, coordinate with the maker, and keep a proof NFT after delivery.

Links:
- Live demo: https://loomon.vercel.app/app
- Docs: https://loomon.vercel.app/app/docs
- Code: https://github.com/PigAssasin/LOOMON

## Slide 2 - The Problem

Custom craft commerce is fragmented.

- Product discovery, customization, seller chat, payment, and proof are split across many tools.
- Buyers do not know if custom orders are clear, paid, accepted, or delivered.
- Sellers receive scattered notes and images instead of a production-ready brief.

## Slide 3 - The Product

LOOMON turns the custom order into one structured journey.

- Browse a visual catalog of Vietnamese ceramic products.
- Add artwork, text, quantity, notes, and timing.
- Let the app generate AI previews or send the reference directly.

## Slide 4 - Buyer Flow

Browse -> Customize -> Pay -> Track -> Prove.

- Buyer chooses the product and final preview.
- Arc payment is signed only at the payment step.
- Orders stay visible in Buying with status and next action.

## Slide 5 - Seller Flow

The seller workspace receives a production brief, not a messy chat thread.

- Incoming paid orders show note, quantity, needed-by date, uploaded artwork, and selected render.
- Seller accepts one order at a time or rejects with refund.
- Chat opens from the green dock button and history stays tied to the order.

## Slide 6 - Agent Layer

The green button is the commerce control room.

- Finds suitable products from the catalog.
- Explains order state and next actions.
- Drafts buyer/seller messages without sending silently.
- Opens order chat with the correct buyer/seller context.

## Slide 7 - Arc Layer

Arc adds trust without making the product feel like a crypto checkout.

- Buyer funds a prepaid order.
- Seller accepts, refunds, marks delivered, or claims through verified lifecycle actions.
- Completion can mint an order proof NFT.

## Slide 8 - Data Foundation

Supabase stores the commerce source of truth.

- Wallet-linked profiles and wallet accounts.
- Products, briefs, assets, orders, status history, and proof records.
- Buyer-seller chat history and personal agent conversations.
- Private assets are served through signed access.

## Slide 9 - Wallet Login

One wallet maps back to one LOOMON account.

- The wallet signs a challenge.
- Server verifies the signature and restores the Supabase session for that wallet identity.
- On any device, the same wallet can recover profile, orders, and order chat history.

## Slide 10 - Why This Matters

LOOMON is a small demo of agentic commerce that feels human.

- Cultural craft products need story, customization, trust, and communication.
- Agents need structured data and safe permissions, not just chat.
- Arc gives commerce actions a verifiable payment and proof layer.

## Slide 11 - Demo Script

1. Open the app.
2. Search or browse products.
3. Customize a ceramic product with artwork/text.
4. Place an Arc order.
5. Switch to seller and accept only that order.
6. Open dock chat and send a buyer/seller message.
7. Mark delivered and show proof flow.

## Slide 12 - Next Steps

- Multi-seller onboarding.
- Stronger dispute UX.
- Richer proof gallery.
- Agent-managed commerce actions with explicit wallet-scoped permissions.
- Larger Vietnamese craft catalog.

## Submission Form Copy

Submission details:

LOOMON is an agent-powered custom souvenir commerce demo for Vietnamese craft. The app lets buyers discover ceramic products, customize them with artwork or text, generate optional AI previews, place Arc testnet orders, chat with the seller, track production, and receive proof after delivery. The seller workspace shows incoming paid orders as production briefs with uploaded images and status actions. Supabase stores wallet-linked identity, products, order state, assets, chat history, and proof records, while Arc verifies the payment and lifecycle milestones.

Link to code:

https://github.com/PigAssasin/LOOMON

Live demo link:

https://loomon.vercel.app/app

Presentation link:

Use the final Canva share link after updating the deck from this file.
