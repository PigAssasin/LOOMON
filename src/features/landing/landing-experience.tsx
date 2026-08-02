"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Sparkles } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

export function LandingExperience() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !root.current) return;

    let cleanup: () => void = () => {};
    void import("gsap").then(async ({ default: gsap }) => {
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      if (!root.current) return;

      const context = gsap.context(() => {
        gsap.timeline({ defaults: { ease: "power3.out" } })
          .from("[data-motion='hero-line']", { yPercent: 115, rotate: 2, duration: 1.05, stagger: 0.1 })
          .from("[data-motion='hero-support']", { y: 24, opacity: 0, duration: 0.75, stagger: 0.1 }, "-=0.55")
          .from("[data-motion='hero-media']", { scale: 1.08, opacity: 0, duration: 1.25 }, "-=1.1");

        gsap.to("[data-motion='hero-media']", {
          yPercent: 10,
          ease: "none",
          scrollTrigger: { trigger: ".landing-hero", start: "top top", end: "bottom top", scrub: 0.7 },
        });

        gsap.to(".landing-progress", {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { start: 0, end: "max", scrub: 0.15 },
        });

        gsap.utils.toArray<HTMLElement>("[data-motion='section']").forEach((section) => {
          const children = section.querySelectorAll("[data-reveal]");
          gsap.from(children, {
            y: 72,
            opacity: 0,
            duration: 0.95,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: { trigger: section, start: "top 78%", once: true },
          });
        });

        gsap.to(".landing-orbit--pink", { xPercent: 38, rotate: 26, ease: "none", scrollTrigger: { trigger: ".landing-agent", start: "top bottom", end: "bottom top", scrub: 1 } });
        gsap.to(".landing-orbit--blue", { xPercent: -30, yPercent: 26, rotate: -20, ease: "none", scrollTrigger: { trigger: ".landing-settlement", start: "top bottom", end: "bottom top", scrub: 1 } });
        gsap.to(".landing-marquee-track", { xPercent: -50, duration: 22, repeat: -1, ease: "none" });
      }, root);
      cleanup = () => context.revert();
    });

    return () => cleanup();
  }, []);

  return (
    <main className="landing" ref={root}>
      <div className="landing-progress" aria-hidden="true" />

      <section className="landing-hero">
        <Image data-motion="hero-media" className="landing-hero-image" src="/images/hero-ceramics.png" fill priority alt="Vietnamese handmade ceramics arranged on a dark studio canvas" sizes="100vw" />
        <nav className="landing-docs-link" aria-label="Project documentation">
          <Link href="/app/docs">Docs</Link>
        </nav>
        <div className="landing-hero-copy">
          <h1 aria-label="Objects worth making"><span className="landing-line-mask"><span data-motion="hero-line">Objects</span></span><span className="landing-line-mask"><span data-motion="hero-line">worth making.</span></span></h1>
          <div className="landing-hero-bottom" data-motion="hero-support"><p>Discover objects from Vietnamese workshops, shape the order with an agent, and settle the deposit in USDC on Arc.</p><Link className="gradient-stroke-button" href="/app"><Sparkles size={17} /> Explore the marketplace</Link></div>
        </div>
        <a className="landing-scroll" href="#story" aria-label="Scroll to story"><ArrowDown size={19} /></a>
      </section>

      <section className="landing-statement" id="story" data-motion="section">
        <h2 data-reveal>Browsing should feel effortless.<br /><span>Ordering should feel certain.</span></h2>
        <p data-reveal>Every product carries structured material, price, MOQ, lead-time and customization data. The beauty stays visual; the complexity stays behind the agent.</p>
      </section>

      <section className="landing-agent" id="agent" data-motion="section">
        <div className="landing-orbit landing-orbit--pink" aria-hidden="true" />
        <div className="landing-feature-index" data-reveal><span>01</span><p className="accent-pink">Agent</p></div>
        <div className="landing-feature-copy"><h2 data-reveal>Tell it the occasion.<br />It handles the constraints.</h2><p data-reveal>The agent searches feasible products, asks what is missing, prepares a quote and invoice, then follows approvals and production milestones.</p><Link data-reveal className="ghost-button" href="/app">Ask the agent <ArrowRight size={17} /></Link></div>
      </section>

      <div className="landing-marquee" aria-hidden="true"><div className="landing-marquee-track"><span>DISCOVER</span><i>·</i><span>REFINE</span><i>·</i><span>ORDER</span><i>·</i><span>FOLLOW UP</span><i>·</i><span>DISCOVER</span><i>·</i><span>REFINE</span><i>·</i><span>ORDER</span><i>·</i><span>FOLLOW UP</span><i>·</i></div></div>

      <section className="landing-settlement" id="settlement" data-motion="section">
        <div className="landing-orbit landing-orbit--blue" aria-hidden="true" />
        <div className="landing-feature-index" data-reveal><span>02</span><p className="accent-blue">Arc</p></div>
        <div className="landing-feature-copy"><h2 data-reveal>One wallet.<br />USDC all the way through.</h2><p data-reveal>Buyers use an embedded Arc wallet or connect Rainbow and other wallets. Deposits settle directly on Arc—without a custom marketplace contract.</p><Link data-reveal className="ghost-button" href="/app">See the payment flow <ArrowRight size={17} /></Link></div>
      </section>

      <section className="landing-sellers" id="sellers" data-motion="section">
        <div><h2 data-reveal>Upload once.<br />Stay understandable.</h2></div>
        <div className="landing-seller-media" data-reveal><Image src="/images/catalog-sheet-loomon-demo.png" alt="A selection of custom Vietnamese ceramic products" fill sizes="(max-width: 800px) 100vw, 50vw" /></div>
        <div className="landing-seller-copy" data-reveal><p>The seller studio turns craft knowledge into clean product versions the agent can search, compare and quote without inventing missing facts.</p><Link className="ghost-button" href="/app/seller/products/new">Open seller studio <ArrowRight size={17} /></Link></div>
      </section>

      <section className="landing-final" data-motion="section"><h2 data-reveal>Find it.<br />Shape it.<br /><span>Make it real.</span></h2><Link data-reveal className="gradient-stroke-button" href="/app">Enter the marketplace <ArrowRight size={18} /></Link></section>
      <footer className="landing-footer"><span>Independent Vietnamese craft</span><span>2026</span></footer>
    </main>
  );
}
