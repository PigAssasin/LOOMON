"use client";

import Link from "next/link";
import { Home, PackageSearch, Plus, Sparkles, UserRound, WalletCards } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { cn } from "@/src/lib/cn";
import { useAgent } from "@/src/features/agent/agent-provider";

export function SiteHeader({ onOpenAgent, children }: { onOpenAgent?: () => void; children?: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAgent } = useAgent();

  function openAccount() {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
  }

  return (
    <>
      {children ? <header className="site-header site-header--discovery">{children}</header> : null}
      <nav className="app-dock" aria-label="App navigation">
        <DockLink href="/app" label="Home" active={pathname === "/app"}><Home size={21} /></DockLink>
        <DockLink href="/app/orders" label="Orders" active={pathname.startsWith("/app/orders")}><PackageSearch size={21} /></DockLink>
        <DockButton label="Personal agent" featured onClick={onOpenAgent ?? (() => openAgent())}><Sparkles size={22} /></DockButton>
        <DockLink href="/app/seller/products/new" label="Add product" active={pathname.includes("/seller/")}><Plus size={22} /></DockLink>
        {isConnected ? <DockLink href="/app/profile" label="Profile" active={pathname === "/app/profile"}><UserRound size={21} /></DockLink> : <DockButton label="Wallet" onClick={openAccount}><WalletCards size={21} /></DockButton>}
      </nav>
    </>
  );
}

function DockButton({ label, children, featured, onClick }: { label: string; children: React.ReactNode; featured?: boolean; onClick: () => void }) {
  return <button className={cn("dock-item", featured && "dock-item--featured")} type="button" aria-label={label} data-tooltip={label} onClick={onClick}>{children}</button>;
}

function DockLink({ label, children, featured, active, href }: { label: string; children: React.ReactNode; featured?: boolean; active?: boolean; href: string }) {
  return <Link className={cn("dock-item", featured && "dock-item--featured", active && "dock-item--active")} href={href} aria-label={label} data-tooltip={label}>{children}</Link>;
}
