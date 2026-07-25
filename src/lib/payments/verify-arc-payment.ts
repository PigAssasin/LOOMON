import { createPublicClient, erc20Abi, getAddress, http, parseEventLogs } from "viem";
import { arcTestnet } from "@/src/lib/chains";
import { ARC_TESTNET } from "@/src/lib/arc";
import { loomonEscrowPoolAbi } from "@/src/lib/payments/escrow-pool";

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

export interface ExpectedEscrowFunding {
  transactionHash: `0x${string}`;
  poolAddress: `0x${string}`;
  orderId: `0x${string}`;
  buyer: `0x${string}`;
  seller: `0x${string}`;
  amountAtomic: bigint;
  termsHash: `0x${string}`;
}

export interface EscrowFundingVerification {
  verified: boolean;
  blockNumber?: bigint;
  logIndex?: number;
  eventPayload?: {
    orderId: `0x${string}`;
    buyer: `0x${string}`;
    seller: `0x${string}`;
    amountAtomic: string;
    termsHash: `0x${string}`;
  };
  reason?: string;
}

export async function verifyArcEscrowFunding(
  expected: ExpectedEscrowFunding,
): Promise<EscrowFundingVerification> {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_TESTNET.rpcUrl),
  });
  const receipt = await client.getTransactionReceipt({
    hash: expected.transactionHash,
  });

  if (receipt.status !== "success") {
    return { verified: false, reason: "Transaction reverted" };
  }
  if (
    getAddress(receipt.from) !== getAddress(expected.buyer)
    || !receipt.to
    || getAddress(receipt.to) !== getAddress(expected.poolAddress)
  ) {
    return {
      verified: false,
      blockNumber: receipt.blockNumber,
      reason: "Transaction sender or pool does not match checkout",
    };
  }

  const events = parseEventLogs({
    abi: loomonEscrowPoolAbi,
    eventName: "OrderFunded",
    logs: receipt.logs,
    strict: true,
  });
  const event = events.find(
    (candidate) =>
      getAddress(candidate.address) === getAddress(expected.poolAddress)
      && candidate.args.orderId.toLowerCase() === expected.orderId.toLowerCase()
      && getAddress(candidate.args.buyer) === getAddress(expected.buyer)
      && getAddress(candidate.args.seller) === getAddress(expected.seller)
      && candidate.args.amountAtomic === expected.amountAtomic
      && candidate.args.termsHash.toLowerCase() === expected.termsHash.toLowerCase(),
  );
  if (!event) {
    return {
      verified: false,
      blockNumber: receipt.blockNumber,
      reason: "Expected OrderFunded event was not found",
    };
  }

  const transferLogs = parseEventLogs({
    abi: erc20Abi,
    eventName: "Transfer",
    logs: receipt.logs,
    strict: false,
  });
  const transfer = transferLogs.some(
    (candidate) =>
      getAddress(candidate.address) === getAddress(ARC_TESTNET.usdcAddress)
      && candidate.args.from
      && candidate.args.to
      && candidate.args.value !== undefined
      && getAddress(candidate.args.from) === getAddress(expected.buyer)
      && getAddress(candidate.args.to) === getAddress(expected.poolAddress)
      && candidate.args.value === expected.amountAtomic,
  );
  if (!transfer) {
    return {
      verified: false,
      blockNumber: receipt.blockNumber,
      reason: "Exact USDC escrow transfer was not found",
    };
  }

  return {
    verified: true,
    blockNumber: receipt.blockNumber,
    logIndex: event.logIndex,
    eventPayload: {
      orderId: event.args.orderId,
      buyer: getAddress(event.args.buyer),
      seller: getAddress(event.args.seller),
      amountAtomic: event.args.amountAtomic.toString(),
      termsHash: event.args.termsHash,
    },
  };
}
