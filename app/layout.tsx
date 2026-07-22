import type { Metadata } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "./globals.css";
import { AppProviders } from "@/src/components/app-providers";

export const metadata: Metadata = {
  title: "LOOMON — Craft lives on",
  description:
    "Discover Vietnamese ceramics and handmade gifts, refine your order with an agent, and place a USDC deposit on Arc.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
