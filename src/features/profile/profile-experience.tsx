"use client";

import Link from "next/link";
import { Check, ChevronRight, Globe2, MapPin, Pencil, Settings, ShieldCheck, Star, UserRound, WalletCards, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ProductCard } from "@/src/components/product-card";
import { SiteHeader } from "@/src/components/site-header";
import { getStoreProducts, stores } from "@/src/data/stores";
import { useFollowedStores } from "@/src/hooks/use-followed-stores";

type EditableProfile = {
  role: "buyer" | "seller";
  displayName: string;
  email: string;
  location: string;
  bio: string;
};

const defaultProfile: EditableProfile = {
  role: "seller",
  displayName: "Lò Mây Studio",
  email: "hello@lomay.studio",
  location: "Bát Tràng, Hà Nội",
  bio: "A small kiln studio making quiet stoneware forms for homes, dining and meaningful gifts. The agent helps with quotes and production follow-up.",
};

export function ProfileExperience() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<EditableProfile>(defaultProfile);
  const [draft, setDraft] = useState<EditableProfile>(defaultProfile);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const { address } = useAccount();
  const { followed } = useFollowedStores();
  const followedStores = stores.filter((store) => followed.includes(store.slug));
  const ownProducts = getStoreProducts("Lò Mây");
  const shortAddress = address ? `${address.slice(0, 7)}…${address.slice(-5)}` : "0x71C4…92EA";
  const visibleProfile = editing ? draft : profile;
  const initials = visibleProfile.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const canSave = Boolean(draft.displayName.trim() && draft.email.includes("@") && draft.location.trim() && draft.bio.trim());

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem("loomon-profile");
      if (stored) {
        const saved = { ...defaultProfile, ...(JSON.parse(stored) as Partial<EditableProfile>) };
        setProfile(saved);
        setDraft(saved);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function saveProfile() {
    if (!canSave) return;
    setProfile(draft);
    window.localStorage.setItem("loomon-profile", JSON.stringify(draft));
    setEditing(false);
  }

  return (
    <main>
      <div className="static-header-wrap"><SiteHeader /></div>
      <section className="profile-page">
        <header className="profile-page-hero">
          <div className="profile-page-avatar">{initials}</div>
          <div className={editing ? "profile-identity profile-identity--editing" : "profile-identity"}>
            {editing ? <div className="profile-role-switch profile-role-switch--inline"><button className={draft.role === "buyer" ? "active" : ""} onClick={() => setDraft({ ...draft, role: "buyer" })} type="button">Buyer</button><button className={draft.role === "seller" ? "active" : ""} onClick={() => setDraft({ ...draft, role: "seller" })} type="button">Seller</button></div> : <p><ShieldCheck size={16} /> {profile.role === "seller" ? "Seller profile" : "Buyer profile"}</p>}
            {editing ? <label className="profile-inline-title"><span className="sr-only">Display name</span><input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label> : <h1>{profile.displayName}</h1>}
            <span><WalletCards size={15} /> {shortAddress}</span>
            {editing ? <label className="profile-inline-location"><MapPin size={15} /><span className="sr-only">Delivery or workshop address</span><input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label> : <span><MapPin size={15} /> {profile.location}</span>}
          </div>
          <div className="profile-hero-actions">{editing ? <><button className="ghost-button" type="button" onClick={() => { setDraft(profile); setEditing(false); }}>Cancel</button><button className="gradient-stroke-button" type="button" disabled={!canSave} onClick={saveProfile}><Check size={17} /> Save changes</button></> : <><button className="ghost-button" type="button" onClick={() => { setDraft(profile); setEditing(true); }}><Pencil size={17} /> Edit profile</button><button className="profile-settings-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Settings size={19} /></button></>}</div>
        </header>

        <div className="profile-page-intro">
          {editing ? <div className="profile-inline-fields"><label><span>About you</span><textarea rows={5} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} /></label><label><span>Email</span><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label><p className="profile-data-note">The agent uses these details only for recommendations, quotes and order preparation.</p></div> : <p>{profile.bio}</p>}
          <dl><div><dt>Products</dt><dd>{ownProducts.length}</dd></div><div><dt>Orders</dt><dd>94</dd></div><div><dt>Rating</dt><dd>4.8 <Star size={15} fill="currentColor" /></dd></div><div><dt>On-time</dt><dd>97%</dd></div></dl>
        </div>

        <section className="profile-products">
          <header><div><h2>Your shop</h2><p>What buyers see on your public profile.</p></div><Link className="gradient-stroke-button" href="/app/seller/products/new">Add product</Link></header>
          <div className="profile-product-grid">{ownProducts.map((product) => <ProductCard product={product} key={product.id} />)}</div>
        </section>

        <section className="profile-following">
          <header><div><h2>Following</h2><p>Stores whose new work you want to keep close.</p></div><span>{followedStores.length}</span></header>
          {followedStores.length ? <div>{followedStores.map((store) => <Link href={`/app/stores/${store.slug}`} key={store.slug}><span className={`accent-bg-${store.accent}`}>{store.initials}</span><span><strong>{store.name}</strong><small>{store.province} · {store.specialties[0]}</small></span><ChevronRight size={19} /></Link>)}</div> : <div className="profile-following-empty"><UserRound size={23} /><p>You are not following a store yet.</p><Link href="/app">Explore makers</Link></div>}
        </section>
      </section>

      {settingsOpen ? <SettingsPanel email={profile.email} onClose={() => setSettingsOpen(false)} saved={settingsSaved} onSave={() => { setSettingsSaved(true); window.setTimeout(() => setSettingsSaved(false), 1500); }} /> : null}
    </main>
  );
}

function SettingsPanel({ email, onClose, onSave, saved }: { email: string; onClose: () => void; onSave: () => void; saved: boolean }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Profile settings"><button className="modal-scrim" onClick={onClose} aria-label="Close settings" /><section className="settings-panel"><header><div><Globe2 size={22} /><span><h2>Settings</h2><p>Personalize your marketplace.</p></span></div><button onClick={onClose} type="button" aria-label="Close settings"><X size={21} /></button></header><form onSubmit={(event) => { event.preventDefault(); onSave(); }}><label><span>Language</span><select defaultValue="English"><option>English</option><option>Tiếng Việt</option></select></label><label><span>Display currency</span><select defaultValue="USDC"><option>USDC</option><option>USD</option><option>VND</option></select></label><label><span>Email</span><input type="email" defaultValue={email} /></label><label className="settings-toggle"><span><strong>Agent order updates</strong><small>Reminders, maker replies and delivery milestones.</small></span><input type="checkbox" defaultChecked /></label><label className="settings-toggle"><span><strong>New work from followed stores</strong><small>A quiet weekly digest, never daily noise.</small></span><input type="checkbox" defaultChecked /></label><button className="gradient-stroke-button full-width" type="submit">{saved ? <><Check size={17} /> Saved</> : "Save settings"}</button></form></section></div>;
}
