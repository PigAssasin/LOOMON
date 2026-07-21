"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { arcTestnet } from "@/src/lib/chains";

const wagmiConfig = getDefaultConfig({
  appName: "Pinterest Markers",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "pinterest-markers-local",
  chains: [arcTestnet],
  ssr: true,
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          theme={darkTheme({ accentColor: "#abff84", accentColorForeground: "#0e100f", borderRadius: "large" })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
