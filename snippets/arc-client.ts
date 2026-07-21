import { createPublicClient, http } from "viem";
import { arcTestnet } from "./wagmi-config";

export const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.network"),
});

export async function pollUntil(
  check: () => Promise<boolean>,
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const { attempts = 30, intervalMs = 2000 } = options;

  for (let i = 0; i < attempts; i++) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}
