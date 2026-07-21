# Arc Development Rules

Use these as starter rules for a new Arc project.

## Network rules

- Keep the app Arc-only unless there is a real product reason to go multi-chain.
- Hardcode the chain ID in one central config: `5042002`.
- Show a clear wrong-network state and let users switch to Arc Testnet.
- Treat `1` confirmation as enough for most UX flows on Arc.

## Token rules

- Gas is paid in `USDC`.
- Do not refer to gas or balances as `ETH`.
- For the USDC ERC-20 contract interface, use `6` decimals.
- Be careful not to mix native precision assumptions with ERC-20 precision assumptions.

## Frontend rules

- Use `wagmi` and `viem`.
- Handle pending, success, error, and wrong-network states in every money flow.
- Keep wallet UI explicit: `connect -> approve -> confirm -> success`.
- If a payment unlocks access, keep the unlock rule obvious in the UI.

## Contract rules

- Use Solidity `^0.8.20`.
- Use OpenZeppelin where it helps.
- Emit events for all state-changing actions.
- Follow checks-effects-interactions.
- Prefer custom errors over long revert strings.
- Do not rely on `block.prevrandao`.

## RPC and indexing rules

- Keep one primary RPC and at least one fallback.
- Retry RPC reads before treating them as failed.
- Because Arc finality is deterministic, indexing logic can be simpler than on reorg-prone chains.
- Still keep idempotent event processing in case your own workers retry.

## Agent and payment rules

- Do not make the agent too general.
- Let the agent gather missing details, then create a structured payment or quote object.
- Keep a clean transition from intent to invoice to payment to fulfillment.
- If you unlock goods or access after payment, keep the state machine explicit.

## Verification rules

- Re-verify addresses and support tables against official Arc docs before deployment.
- Do not assume testnet facts will match future mainnet facts.
- If a capability is time-sensitive or product-specific, check official docs again.
