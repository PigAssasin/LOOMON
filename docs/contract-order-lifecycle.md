# Pinterest Markers — Order and Escrow Lifecycle

## Architectural decision

The Orders UI groups contract states into three user-facing stages:

1. **Confirm & fund**
2. **In escrow**
3. **Settled**

This follows Arc's programmable escrow and ERC-8183 job lifecycle while keeping the interface understandable for a normal marketplace user.

`ERC-8183` is referenced because it is part of Arc's official Agentic Economy documentation. It is not a Ritual dependency, integration, SDK, or platform reference. The product remains Arc-only; the final physical-commerce contract may adopt only the lifecycle concepts that pass the project's own contract specification and security review.

## Roles

- **Buyer:** confirms the quote, funds escrow, reviews delivery and can open a dispute.
- **Seller:** accepts the commercial terms, produces the item, submits proof and ships the order.
- **Agent:** prepares structured terms, watches deadlines, requests evidence, sends reminders and recommends acceptance, rejection or escalation.
- **Evaluator / arbitrator:** the authorized signer or policy module that can accept a deliverable or resolve a dispute. The Agent must not unilaterally move user funds unless the user has explicitly delegated narrowly scoped authority.
- **Escrow contract:** holds USDC and enforces allowed state transitions.

## Stage 1 — Confirm & fund

Contract-level states grouped here:

- `Draft`: quote and customization data still live offchain in Supabase.
- `Created`: immutable order terms are committed onchain, ideally using a hash of the normalized order version.
- `AwaitingSellerAcceptance`: seller has not accepted price, deadlines and deliverables.
- `AwaitingBuyerFunding`: buyer has accepted but escrow has not received USDC.
- `FundingPending`: approval/Permit2 and funding transaction submitted but not yet final.

Recommended flow:

1. Agent converts the conversation into a versioned order specification.
2. Buyer and seller review the same order-version hash.
3. Contract creates the escrow/job with buyer, seller, evaluator, USDC amount and deadlines.
4. Buyer approves the required USDC allowance and calls `fund`.
5. When Arc includes the transaction, it is final; the UI moves the order directly to **In escrow**.

## Stage 2 — In escrow

Contract-level states grouped here:

- `Funded`: USDC is locked in the contract.
- `InProduction`: seller is producing the order.
- `DeliverableSubmitted`: seller submits a proof URI/hash, shipment evidence or milestone evidence.
- `UnderReview`: buyer/evaluator is reviewing the submission.
- `Disputed`: release is paused while evidence is reviewed.

The physical-product implementation should extend the ERC-8183-style job flow with production and shipping milestones. Large orders should support multiple escrow milestones rather than locking the entire amount behind one final approval.

Agent responsibilities:

- watch contract events and Supabase deadlines;
- remind the seller before missed milestones;
- request photos, tracking information and structured proof;
- explain the next action to the buyer;
- propose acceptance, refund or escalation;
- never invent an onchain state from chat history.

## Stage 3 — Settled

Terminal states grouped here:

- `Released`: buyer/evaluator accepted; contract releases USDC to seller and marketplace fee recipient.
- `Refunded`: escrow returns all or an authorized portion to the buyer.
- `Cancelled`: order ended before funded production, following the contract's cancellation rules.

Every terminal record should retain contract address, chain ID, order ID, order-version hash, transaction hash, amounts, timestamps and event log identifiers.

## Minimum contract interface

Suggested commands:

- `createOrder(termsHash, seller, evaluator, amount, deadlines)`
- `acceptOrder(orderId)`
- `fundOrder(orderId)`
- `submitMilestone(orderId, milestoneId, evidenceHash)`
- `acceptMilestone(orderId, milestoneId)`
- `raiseDispute(orderId, reasonHash)`
- `resolveDispute(orderId, buyerAmount, sellerAmount)`
- `cancelOrder(orderId)`

Suggested events:

- `OrderCreated`
- `OrderAccepted`
- `OrderFunded`
- `MilestoneSubmitted`
- `MilestoneAccepted`
- `DisputeRaised`
- `OrderReleased`
- `OrderRefunded`
- `OrderCancelled`

The backend consumes these events through an idempotent webhook/event-indexing pipeline and projects them into Supabase for fast UI queries. The chain remains the authority for payment state; Supabase remains the authority for rich product, conversation, shipping and evidence metadata.

## Arc-specific rules

- Arc is EVM-compatible, so the escrow can be written in Solidity and called with Viem/Wagmi.
- USDC is the native gas token on Arc and also exposes an ERC-20 interface for allowance and `transferFrom` workflows.
- A transaction is pending or final; after inclusion, deterministic finality means the UI does not need a multi-confirmation state.
- Contract events should drive order status changes. Webhooks provide real-time projection, while periodic reconciliation protects against missed deliveries.
- Arc is currently testnet-only. Contract addresses and network constants must be environment-scoped and revalidated before mainnet deployment.

## Security boundary

Before deploying the contract, require tests and an external audit for reentrancy, authorization, replay, signature/domain separation, fee rounding, deadline manipulation, partial refund accounting, dispute authority, pause/recovery and upgrade controls. Agent automation should use explicit policies, spending caps, time limits and revocable session permissions.

## Official references

- https://docs.arc.io/build/agentic-economy
- https://docs.arc.io/build/ecommerce
- https://docs.arc.io/arc/concepts/deterministic-finality
- https://docs.arc.io/integrate/wallets/transaction-lifecycle
- https://docs.arc.io/arc/tutorials/monitor-contract-events
- https://docs.arc.io/arc/references/contract-addresses
