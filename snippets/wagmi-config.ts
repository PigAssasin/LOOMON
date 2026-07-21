import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { defineChain, parseGwei } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    fallback: { http: ["https://rpc.blockdaemon.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  fees: {
    defaultPriorityFee: parseGwei("1"),
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http("https://rpc.testnet.arc.network", {
      retryCount: 3,
      retryDelay: 500,
    }),
  },
  ssr: true,
});
