"use client";

import Link from "next/link";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  ExternalLink,
  Globe2,
  LogOut,
  MapPin,
  Pencil,
  RefreshCw,
  Settings,
  ShoppingBag,
  Store,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/src/components/product-card";
import { SiteHeader } from "@/src/components/site-header";
import { products } from "@/src/data/products";
import { stores } from "@/src/data/stores";
import { buildOrderProofExplorerUrl, type OrderProofRecord } from "@/src/domain/order-proof";
import { commerceWorkspaceSchema, emptyCommerceWorkspace } from "@/src/domain/commerce-workspace";
import { useLoomonSession } from "@/src/features/auth/use-loomon-session";
import { useFollowedStores } from "@/src/hooks/use-followed-stores";

type ProfileData = {
  userId: string;
  displayName: string | null;
  email: string | null;
  location: string | null;
  bio: string | null;
  preferredLocale: "vi" | "en";
  timezone: string;
  wallet: { address: string; chainId: number; verifiedAt: string } | null;
  memberships: Array<{ makerId: number; makerSlug: string; makerName: string; role: string }>;
};

type PurchasedProof = OrderProofRecord & { orderNumber: string };

type ProfileDraft = {
  displayName: string;
  email: string;
  location: string;
  bio: string;
  preferredLocale: "vi" | "en";
};

const emptyDraft: ProfileDraft = {
  displayName: "",
  email: "",
  location: "",
  bio: "",
  preferredLocale: "en",
};

export function ProfileExperience() {
  const session = useLoomonSession();
  const [profile, setProfile] = useState<ProfileData>();
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [proofs, setProofs] = useState<PurchasedProof[]>([]);
  const [commerceCounts, setCommerceCounts] = useState({ buying: 0, selling: 0 });
  const [publishedCount, setPublishedCount] = useState(0);
  const { followed } = useFollowedStores();
  const followedStores = stores.filter((store) => followed.includes(store.slug));

  const load = useCallback(async () => {
    if (!session.supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data: authData } = await session.supabase.auth.getSession();
    if (!authData.session) {
      setProfile(undefined);
      setLoading(false);
      return;
    }

    const [{ data: profileData, error: profileError }, { data: workspaceData }, proofResponse] = await Promise.all([
      session.supabase.rpc("get_my_profile"),
      session.supabase.rpc("get_my_commerce_workspace"),
      fetch("/api/purchases/proofs"),
    ]);
    if (profileError || !profileData) {
      setError("Your profile could not be loaded.");
      setLoading(false);
      return;
    }
    const nextProfile = profileData as unknown as ProfileData;
    setProfile(nextProfile);
    setDraft({
      displayName: nextProfile.displayName ?? "",
      email: nextProfile.email ?? "",
      location: nextProfile.location ?? "",
      bio: nextProfile.bio ?? "",
      preferredLocale: nextProfile.preferredLocale ?? "en",
    });

    const workspace = commerceWorkspaceSchema.parse(workspaceData ?? emptyCommerceWorkspace);
    setCommerceCounts({
      buying: workspace.buyingRequests.length + workspace.buyingOrders.length,
      selling: workspace.sellingRequests.length + workspace.sellingOrders.length,
    });
    if (proofResponse.ok) {
      const proofData = await proofResponse.json() as { proofs: PurchasedProof[] };
      setProofs(proofData.proofs);
    }

    const makerIds = nextProfile.memberships.map((membership) => membership.makerId);
    if (makerIds.length) {
      const { count } = await session.supabase
        .from("published_products")
        .select("id", { count: "exact", head: true })
        .in("maker_id", makerIds);
      setPublishedCount(count ?? 0);
    } else {
      setPublishedCount(0);
    }
    setLoading(false);
  }, [session.supabase]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void load();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  useEffect(() => {
    if (!session.supabase || !profile?.userId) return;
    const channel = session.supabase
      .channel(`loomon-profile-${profile.userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profile.userId}` }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "commerce", table: "orders" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "commerce", table: "order_proof_nfts", filter: `owner_user_id=eq.${profile.userId}` }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void session.supabase?.removeChannel(channel);
    };
  }, [load, profile?.userId, session.supabase]);

  const sellerNames = useMemo(
    () => new Set(profile?.memberships.map((membership) => membership.makerName) ?? []),
    [profile],
  );
  const ownProducts = products.filter((product) => sellerNames.has(product.makerName));
  const displayName = profile?.displayName || "New LOOMON member";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const walletAddress = profile?.wallet?.address ?? session.address;
  const shortAddress = walletAddress ? `${walletAddress.slice(0, 7)}…${walletAddress.slice(-5)}` : "Not connected";
  const canSave = Boolean(draft.displayName.trim());

  async function connect() {
    if (await session.ensureSession()) await load();
  }

  async function saveProfile() {
    if (!session.supabase || !canSave) return;
    setSaving(true);
    setError("");
    const { error: saveError } = await session.supabase.rpc("update_my_profile", {
      p_display_name: draft.displayName.trim(),
      p_email: draft.email.trim(),
      p_location: draft.location.trim(),
      p_bio: draft.bio.trim(),
      p_preferred_locale: draft.preferredLocale,
    });
    setSaving(false);
    if (saveError) {
      setError("Your profile was not saved. Check the fields and try again.");
      return;
    }
    setEditing(false);
    await load();
  }

  if (loading) {
    return <ProfileShell><div className="profile-proof-empty"><RefreshCw className="proof-loading-icon" size={22} /><p>Loading your profile…</p></div></ProfileShell>;
  }

  if (!profile) {
    return <ProfileShell><section className="profile-connect-empty"><WalletCards size={28} /><h1>Your LOOMON profile</h1><p>Connect once to see your real orders, shop, messages and Arc proofs.</p><button className="gradient-stroke-button" type="button" disabled={session.busy} onClick={() => void connect()}>Connect wallet</button>{session.error ? <p className="form-error">{session.error}</p> : null}</section></ProfileShell>;
  }

  return (
    <ProfileShell>
      <header className="profile-page-hero profile-page-hero--clean">
        <div className="profile-page-avatar">{initials}</div>
        <div className="profile-identity">
          <p>{profile.memberships.length ? <><Store size={16} /> Buyer · Seller</> : <><UserRound size={16} /> Buyer</>}</p>
          {editing ? <label className="profile-inline-title"><span className="sr-only">Display name</span><input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label> : <h1>{displayName}</h1>}
          <span><WalletCards size={15} /> {shortAddress}</span>
          {editing ? <label className="profile-inline-location"><MapPin size={15} /><span className="sr-only">Location</span><input value={draft.location} placeholder="City or workshop location" onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label> : profile.location ? <span><MapPin size={15} /> {profile.location}</span> : null}
        </div>
        <div className="profile-hero-actions">
          {editing ? <>
            <button className="ghost-button" type="button" onClick={() => setEditing(false)}>Cancel</button>
            <button className="gradient-stroke-button" type="button" disabled={!canSave || saving} onClick={() => void saveProfile()}><Check size={17} /> Save</button>
          </> : <>
            <button className="ghost-button" type="button" onClick={() => setEditing(true)}><Pencil size={17} /> Edit profile</button>
            <button className="ghost-button" type="button" disabled={session.busy} onClick={() => void session.signOut()}><LogOut size={17} /> Disconnect</button>
            <button className="profile-settings-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Settings size={19} /></button>
          </>}
        </div>
      </header>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="profile-page-intro profile-page-intro--clean">
        {editing ? <div className="profile-inline-fields">
          <label><span>About you</span><textarea rows={4} value={draft.bio} placeholder="A short introduction for buyers and sellers." onChange={(event) => setDraft({ ...draft, bio: event.target.value })} /></label>
          <label><span>Email</span><input type="email" value={draft.email} placeholder="you@example.com" onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
        </div> : <p>{profile.bio || "Add a short introduction so people know who they are working with."}</p>}
        <dl>
          <div><dt>Buying</dt><dd>{commerceCounts.buying}</dd></div>
          <div><dt>Selling</dt><dd>{commerceCounts.selling}</dd></div>
          <div><dt>Published</dt><dd>{publishedCount}</dd></div>
          <div><dt>Arc proofs</dt><dd>{proofs.length}</dd></div>
        </dl>
      </div>

      <section className="profile-purchased">
        <header><div><h2>Purchased</h2><p>Proofs minted after you confirm successful demo delivery.</p></div><span>{proofs.length}</span></header>
        {proofs.length ? <div className="profile-proof-grid">{proofs.map((proof) => <OrderProofCard key={proof.id} proof={proof} />)}</div> : <div className="profile-proof-empty"><ShoppingBag size={23} /><div><strong>No delivery proofs yet.</strong><p>Your proof appears after the seller marks delivery and you confirm receipt.</p></div><Link href="/app">Explore products</Link></div>}
      </section>

      {profile.memberships.length ? <section className="profile-products">
        <header><div><h2>Your shop</h2><p>{profile.memberships.map((membership) => membership.makerName).join(", ")}</p></div><Link className="gradient-stroke-button" href="/app/seller/products/new">Add product</Link></header>
        {ownProducts.length ? <div className="profile-product-grid">{ownProducts.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <div className="profile-proof-empty"><Store size={23} /><p>No published products for this shop yet.</p></div>}
      </section> : <section className="profile-shop-start"><Store size={23} /><div><h2>Want to sell?</h2><p>Choose an available demo shop from the Selling workspace, then manage its requests here.</p></div><Link href="/app/orders">Open Selling</Link></section>}

      <section className="profile-following">
        <header><div><h2>Following</h2><p>Stores you want to find again.</p></div><span>{followedStores.length}</span></header>
        {followedStores.length ? <div>{followedStores.map((store) => <Link href={`/app/stores/${store.slug}`} key={store.slug}><span className={`accent-bg-${store.accent}`}>{store.initials}</span><span><strong>{store.name}</strong><small>{store.province} · {store.specialties[0]}</small></span><ChevronRight size={19} /></Link>)}</div> : <div className="profile-following-empty"><UserRound size={23} /><p>You are not following a store yet.</p><Link href="/app">Explore makers</Link></div>}
      </section>

      {settingsOpen ? <SettingsPanel profile={profile} draft={draft} setDraft={setDraft} onClose={() => setSettingsOpen(false)} onSave={async () => { await saveProfile(); setSettingsOpen(false); }} /> : null}
    </ProfileShell>
  );
}

function ProfileShell({ children }: { children: React.ReactNode }) {
  return <main><div className="static-header-wrap"><SiteHeader /></div><section className="profile-page">{children}</section></main>;
}

function OrderProofCard({ proof }: { proof: PurchasedProof }) {
  const explorerUrl = buildOrderProofExplorerUrl(proof.mintTransactionHash);
  return <article className="profile-proof-card"><div className="profile-proof-visual"><span>LOOMON</span><small>DELIVERY PROOF</small><strong>#{proof.tokenId ?? "—"}</strong><em>ARC TESTNET · DEMO</em><code>{proof.orderHash.slice(0, 18)}…</code><i>Buyer-confirmed delivery. No authenticity or investment claim.</i></div><div className="profile-proof-copy"><span className={`profile-proof-status profile-proof-status--${proof.mintStatus}`}>{proof.mintStatus === "confirmed" ? <BadgeCheck size={15} /> : <RefreshCw size={14} />}{proof.mintStatus === "confirmed" ? "Confirmed on Arc" : "Minting"}</span><h3>{proof.orderNumber}</h3><p>Non-transferable proof of the buyer-confirmed demo delivery.</p>{explorerUrl ? <a href={explorerUrl} target="_blank" rel="noreferrer">View transaction <ExternalLink size={14} /></a> : null}</div></article>;
}

function SettingsPanel({ profile, draft, setDraft, onClose, onSave }: { profile: ProfileData; draft: ProfileDraft; setDraft: React.Dispatch<React.SetStateAction<ProfileDraft>>; onClose: () => void; onSave: () => Promise<void> }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Profile settings"><button className="modal-scrim" onClick={onClose} aria-label="Close settings" /><section className="settings-panel"><header><div><Globe2 size={22} /><span><h2>Settings</h2><p>Language and contact details.</p></span></div><button onClick={onClose} type="button" aria-label="Close settings"><X size={21} /></button></header><form onSubmit={(event) => { event.preventDefault(); void onSave(); }}><label><span>Language</span><select value={draft.preferredLocale} onChange={(event) => setDraft({ ...draft, preferredLocale: event.target.value as "vi" | "en" })}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label><label><span>Email</span><input type="email" value={draft.email || profile.email || ""} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label><button className="gradient-stroke-button full-width" type="submit">Save settings</button></form></section></div>;
}
