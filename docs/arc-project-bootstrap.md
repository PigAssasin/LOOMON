# Arc Project Bootstrap

This is the minimum checklist to start a fresh project on Arc.

## 1. Decide the project shape

Pick one:
- frontend-only payment app
- frontend plus API backend
- frontend plus smart contracts
- agent workflow app with payments

## 2. Add Arc to wallet and local config

Use:
- Network: `Arc Testnet`
- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Symbol: `USDC`

## 3. Install the usual stack

Frontend:

```bash
npm install wagmi viem @tanstack/react-query
```

If you need Circle App Kit:

```bash
npm install @circle-fin/app-kit @circle-fin/adapter-viem-v2
```

Contracts:

```bash
npm install -D hardhat @nomicfoundation/hardhat-toolbox dotenv
```

## 4. Ask for testnet funds

- Use the Circle faucet: [https://faucet.circle.com](https://faucet.circle.com)
- Request Arc Testnet USDC
- Fund the wallet that will deploy or transact

## 5. Use Arc-only chain config first

Keep the first version simple:
- one chain only
- one RPC only with one fallback
- one explorer
- no multi-chain abstraction until needed

## 6. If the project uses contracts

Recommended defaults:
- Solidity `^0.8.20`
- optimizer enabled
- `Hardhat` or `Foundry`
- wait for `1` confirmation
- no logic that depends on `PREVRANDAO`

## 7. If the project uses agents

Good Arc-aligned patterns:
- quote agent plus payment request
- deposit invoice flow
- wallet send flow
- fulfillment unlock after payment
- cross-border stablecoin settlement

## 8. If the project uses App Kit

Relevant official references:
- supported chains and tokens
- send
- bridge
- swap
- unified balance

Start with:
- `Send` for same-chain USDC
- `Bridge` only if you really need cross-chain intake

## 9. Production habits from day one

- keep addresses in one place
- separate testnet and production env vars
- handle wrong-network states clearly
- handle insufficient-USDC-for-gas states clearly
- keep transaction polling simple and explicit

## 10. Things to verify every time

- chain ID
- token address
- RPC endpoint
- explorer URL
- App Kit support for your exact chain and token
- wallet funding assumptions
