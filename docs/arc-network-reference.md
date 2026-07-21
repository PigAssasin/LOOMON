# Arc Network Reference

Source of truth for the public Arc Testnet setup.

Last checked against official Arc docs on July 19, 2026:
- [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc)
- [RPC endpoints](https://docs.arc.io/arc/references/rpc-endpoints)
- [Arc network overview](https://docs.arc.io/arc-chain)
- [Infrastructure integration](https://docs.arc.io/integrate/infrastructure)

## Network parameters

| Field | Value |
| --- | --- |
| Network name | `Arc Testnet` |
| Chain ID | `5042002` |
| Currency symbol | `USDC` |
| Primary RPC | `https://rpc.testnet.arc.network` |
| Primary WebSocket | `wss://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Faucet | `https://faucet.circle.com` |

## Chain characteristics

| Property | Value |
| --- | --- |
| Consensus | `Malachite BFT` |
| Execution layer | `EVM (Prague hard fork)` |
| Finality | `Deterministic, sub-second` |
| Typical block time | `~0.48 s` |
| Reorg handling | `No reorgs expected on committed blocks` |
| Recommended confirmations | `1` |
| Native gas token | `USDC` |

## RPC providers

| Provider | HTTP | WebSocket |
| --- | --- | --- |
| Primary | `https://rpc.testnet.arc.network` | `wss://rpc.testnet.arc.network` |
| Blockdaemon | `https://rpc.blockdaemon.testnet.arc.network` | `wss://rpc.blockdaemon.testnet.arc.network:443/websocket` |
| dRPC | `https://rpc.drpc.testnet.arc.network` | `wss://rpc.drpc.testnet.arc.network` |
| QuickNode | `https://rpc.quicknode.testnet.arc.network` | `wss://rpc.quicknode.testnet.arc.network` |

## Token addresses

| Token | Address | Notes |
| --- | --- | --- |
| USDC | `0x3600000000000000000000000000000000000000` | Native gas token, ERC-20 interface uses 6 decimals |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | Euro stablecoin |
| USYC | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` | Yield-bearing asset |

## Infrastructure addresses

| Contract | Address |
| --- | --- |
| TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| TokenMinterV2 | `0xb43db544E2c27092c107639Ad201b3dEfAbcF192` |
| GatewayWallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| GatewayMinter | `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| CREATE2 Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |
| Pyth | `0x2880aB155794e7179c9eE2e38200202908C17B43` |

## AI registry addresses

| Registry | Address |
| --- | --- |
| Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| Validation Registry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |

## Integration cautions

- Treat Arc as Arc-only in wallet config unless you explicitly need multi-chain UX.
- Label balances as `USDC`, not `ETH`.
- Remember the dual precision model:
  - native balance semantics: 18 decimals
  - ERC-20 USDC contract interface: 6 decimals
- Re-verify contract addresses before mainnet or production use.
