import { defineChain } from "viem";
import { ARC_TESTNET } from "@/src/lib/arc";

export const arcTestnet = defineChain({
  id: ARC_TESTNET.id,
  name: ARC_TESTNET.name,
  nativeCurrency: ARC_TESTNET.nativeCurrency,
  rpcUrls: {
    default: { http: [ARC_TESTNET.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: ARC_TESTNET.explorerUrl },
  },
  testnet: true,
});
