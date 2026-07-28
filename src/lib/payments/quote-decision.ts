import { parseAbi } from "viem";

export const LOOMON_QUOTE_DECISION_ADDRESS =
  (process.env.NEXT_PUBLIC_LOOMON_QUOTE_DECISION_ADDRESS as `0x${string}` | undefined)
  ?? "0x0af0d368ed7a742f623103FDf9e43a193f330380";

export const loomonQuoteDecisionAbi = parseAbi([
  "function decide(bytes32 requestIdHash, uint8 decision, bytes32 decisionHash)",
  "event QuoteRequestDecided(bytes32 indexed requestIdHash, address indexed seller, uint8 indexed decision, bytes32 decisionHash)",
]);

export const quoteDecisionCode = {
  accept: 1,
  reject: 2,
} as const;
