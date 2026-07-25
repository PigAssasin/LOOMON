import { parseAbi } from "viem";

export const loomonEscrowPoolAbi = parseAbi([
  "function placeOrder(bytes32 orderId, address seller, uint256 amountAtomic, bytes32 termsHash)",
  "function startProduction(bytes32 orderId)",
  "function markDelivered(bytes32 orderId, bytes32 evidenceHash)",
  "function confirmCompletion(bytes32 orderId, bytes32 evidenceHash)",
  "function claimSellerFunds(bytes32 orderId)",
  "function cancelBeforeProduction(bytes32 orderId, bytes32 reasonHash)",
  "function refundBuyer(bytes32 orderId, bytes32 reasonHash)",
  "function raiseDispute(bytes32 orderId, bytes32 reasonHash)",
  "event OrderFunded(bytes32 indexed orderId, address indexed buyer, address indexed seller, uint256 amountAtomic, bytes32 termsHash)",
  "event ProductionStarted(bytes32 indexed orderId, address indexed seller)",
  "event OrderDelivered(bytes32 indexed orderId, address indexed seller, bytes32 evidenceHash)",
  "event CompletionConfirmed(bytes32 indexed orderId, address indexed buyer, bytes32 evidenceHash, uint64 sellerClaimableAt)",
  "event SellerFundsClaimed(bytes32 indexed orderId, address indexed seller, uint256 amountAtomic)",
  "event BuyerRefunded(bytes32 indexed orderId, address indexed actor, address indexed buyer, uint256 amountAtomic, bytes32 reasonHash)",
  "event DisputeRaised(bytes32 indexed orderId, address indexed actor, bytes32 reasonHash)",
]);
