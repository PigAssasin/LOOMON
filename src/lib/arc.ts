export const ARC_TESTNET = {
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
  explorerUrl:
    process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app",
  usdcAddress:
    process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS ??
    "0x3600000000000000000000000000000000000000",
} as const;

export type WalletMode = "embedded" | "external";

export interface WalletSummary {
  mode: WalletMode;
  address: `0x${string}`;
  balanceUsdc: string;
  canDelegate: boolean;
  gasSponsored: boolean;
}

export const DEMO_WALLET: WalletSummary = {
  mode: "embedded",
  address: "0x72d69D0B4A7e7812B958AA905BF6a932DE18F40A",
  balanceUsdc: "684.20",
  canDelegate: true,
  gasSponsored: true,
};
