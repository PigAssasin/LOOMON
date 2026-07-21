import { createPublicClient, erc20Abi, getAddress, http, parseEventLogs } from "viem";
import { arcTestnet } from "@/src/lib/chains";
import { ARC_TESTNET } from "@/src/lib/arc";

export interface ExpectedPayment {
  transactionHash: `0x${string}`;
  payer: `0x${string}`;
  recipient: `0x${string}`;
  amountAtomic: bigint;
}

export interface PaymentVerification {
  verified: boolean;
  blockNumber?: bigint;
  reason?: string;
}

export async function verifyArcUsdcPayment(expected: ExpectedPayment): Promise<PaymentVerification> {
  const client = createPublicClient({ chain: arcTestnet, transport: http(ARC_TESTNET.rpcUrl) });
  const receipt = await client.getTransactionReceipt({ hash: expected.transactionHash });

  if (receipt.status !== "success") return { verified: false, reason: "Transaction reverted" };

  const logs = parseEventLogs({
    abi: erc20Abi,
    eventName: "Transfer",
    logs: receipt.logs,
    strict: false,
  });

  const match = logs.some((log) => {
    if (getAddress(log.address) !== getAddress(ARC_TESTNET.usdcAddress)) return false;
    const args = log.args;
    return args.from && args.to && args.value !== undefined
      && getAddress(args.from) === getAddress(expected.payer)
      && getAddress(args.to) === getAddress(expected.recipient)
      && args.value >= expected.amountAtomic;
  });

  return match
    ? { verified: true, blockNumber: receipt.blockNumber }
    : { verified: false, blockNumber: receipt.blockNumber, reason: "Expected USDC transfer was not found" };
}
