"use client";

import { Check, ChevronDown, ImagePlus, Send, Sparkles, UploadCloud, X } from "lucide-react";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/src/components/site-header";
import { productDraftSchema, type ProductDraftInput } from "@/src/domain/product-draft";
import { formatMoney } from "@/src/lib/money";

const initialDraft: ProductDraftInput = {
  title: "",
  category: "Drinkware",
  story: "",
  material: "Stoneware",
  finish: "",
  priceFrom: 0,
  minimumOrderQuantity: 1,
  leadTimeMinDays: 14,
  leadTimeMaxDays: 28,
  customizable: false,
  customizationCapabilities: [],
};

const examplePrompt = "Bộ ấm trà sen vẽ tay bằng sứ, men lam cobalt. Giá từ 42 USDC, có thể đặt 1 bộ, làm trong 24–35 ngày. Có thể thêm monogram, logo hoặc lời chúc.";
const productCategories: ProductDraftInput["category"][] = ["Drinkware", "Tableware", "Decor", "Tea"];

export function ProductUploadWizard() {
  const [draft, setDraft] = useState<ProductDraftInput>(initialDraft);
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [agentDone, setAgentDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const validation = useMemo(() => productDraftSchema.safeParse(draft), [draft]);
  const issues = validation.success ? [] : validation.error.issues;

  function askAgent() {
    if (!prompt.trim()) return;
    setDraft((current) => inferProductDraft(prompt, current));
    setAgentDone(true);
  }

  function toggleCapability(capability: string) {
    setDraft((current) => ({ ...current, customizationCapabilities: current.customizationCapabilities.includes(capability) ? current.customizationCapabilities.filter((item) => item !== capability) : [...current.customizationCapabilities, capability] }));
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    setImages((current) => [...current, ...Array.from(files).map((file) => URL.createObjectURL(file))].slice(0, 6));
  }

  if (submitted) {
    return <main><div className="static-header-wrap"><SiteHeader /></div><section className="seller-success seller-success--simple"><span className="success-mark"><Check size={34} /></span><h1>Ready for review.</h1><p>Your structured draft is saved. The agent will flag anything the reviewer needs from you.</p><Link className="gradient-stroke-button" href="/app">Return to the collection</Link></section></main>;
  }

  return (
    <main>
      <div className="static-header-wrap"><SiteHeader /></div>
      <section className="listing-studio">
        <header className="listing-heading"><div><h1>List a product.</h1><p>Describe it naturally, or use the green Agent button for guided help.</p></div><span>{validation.success ? <><Check size={15} /> Ready</> : `${issues.length} details left`}</span></header>

        <div className="listing-layout">
          <section className="listing-agent-column">
            <div className="listing-agent-title"><span><ImagePlus size={21} /></span><div><h2>Describe the product</h2><p>You can write in Vietnamese or English.</p></div></div>
            <label className="listing-prompt">
              <span className="sr-only">Describe your product</span>
              <textarea rows={8} value={prompt} onChange={(event) => { setPrompt(event.target.value); setAgentDone(false); }} placeholder="Ví dụ: Tôi bán bộ cốc men ngọc làm thủ công, giá từ 12 USDC..." />
              <button type="button" disabled={!prompt.trim()} onClick={askAgent}><Send size={18} /><span>Extract details</span></button>
            </label>
            <button className="listing-example" type="button" onClick={() => { setPrompt(examplePrompt); setAgentDone(false); }}><Sparkles size={14} /> Try an example</button>
            {agentDone ? <div className="listing-agent-result"><Check size={17} /><p><strong>Details extracted.</strong> Check the highlighted fields before submitting.</p></div> : null}

            <div className="listing-media-block">
              <div><h2>Photos</h2><span>{images.length}/6</span></div>
              <label className="listing-upload"><UploadCloud size={25} /><span>{images.length ? "Add more photos" : "Add product photos"}</span><small>JPG, PNG or WebP</small><input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFiles(event.target.files)} /></label>
              {images.length ? <div className="listing-preview">{images.map((image, index) => <figure key={image}><Image src={image} alt={`Product upload ${index + 1}`} width={260} height={260} unoptimized /><button type="button" onClick={() => setImages((current) => current.filter((item) => item !== image))} aria-label={`Remove photo ${index + 1}`}><X size={14} /></button>{index === 0 ? <figcaption>Cover</figcaption> : null}</figure>)}</div> : <p className="listing-photo-note"><ImagePlus size={15} /> A clear cover photo helps the agent describe shape, color and finish.</p>}
            </div>
          </section>

          <section className="listing-details-column">
            <header><div><h2>Product details</h2><p>Review what the agent understood.</p></div><span>Draft</span></header>
            <div className="listing-fields">
              <label className="field-wide"><span>Title</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Product name" /></label>
              <label><span>Category</span><div className="dark-select">
                <button type="button" onClick={() => setCategoryOpen((value) => !value)} aria-expanded={categoryOpen} aria-haspopup="listbox">
                  {draft.category}<ChevronDown size={16} />
                </button>
                {categoryOpen ? <div className="dark-select-menu" role="listbox" aria-label="Category">
                  {productCategories.map((item) => <button
                    className={draft.category === item ? "active" : ""}
                    key={item}
                    role="option"
                    aria-selected={draft.category === item}
                    type="button"
                    onClick={() => {
                      setDraft({ ...draft, category: item });
                      setCategoryOpen(false);
                    }}
                  >
                    <span>{item}</span>{draft.category === item ? <Check size={15} /> : null}
                  </button>)}
                </div> : null}
              </div></label>
              <label><span>Material</span><input value={draft.material} onChange={(event) => setDraft({ ...draft, material: event.target.value })} /></label>
              <label><span>Finish</span><input value={draft.finish} onChange={(event) => setDraft({ ...draft, finish: event.target.value })} placeholder="Color or finish" /></label>
              <label><span>From · USDC</span><input type="number" value={draft.priceFrom || ""} onChange={(event) => setDraft({ ...draft, priceFrom: Number(event.target.value) })} /></label>
              <label><span>Minimum order</span><input type="number" value={draft.minimumOrderQuantity} onChange={(event) => setDraft({ ...draft, minimumOrderQuantity: Number(event.target.value) })} /></label>
              <label className="lead-time-field"><span>Lead time · days</span><div><input aria-label="Minimum lead time" type="number" value={draft.leadTimeMinDays} onChange={(event) => setDraft({ ...draft, leadTimeMinDays: Number(event.target.value) })} /><i>to</i><input aria-label="Maximum lead time" type="number" value={draft.leadTimeMaxDays} onChange={(event) => setDraft({ ...draft, leadTimeMaxDays: Number(event.target.value) })} /></div></label>
              <label className="field-wide"><span>Product story</span><textarea rows={5} value={draft.story} onChange={(event) => setDraft({ ...draft, story: event.target.value })} placeholder="How it is made and what makes it special" /></label>
            </div>

            <div className="listing-customization">
              <label><span><strong>Accept custom orders</strong><small>Let buyers ask the agent for variations.</small></span><input type="checkbox" checked={draft.customizable} onChange={(event) => setDraft({ ...draft, customizable: event.target.checked })} /></label>
              {draft.customizable ? <div>{["2D logo print", "Raised 3D mark", "Engraved text", "Custom motif", "Name personalization", "Gift message"].map((capability) => <button className={draft.customizationCapabilities.includes(capability) ? "active" : ""} onClick={() => toggleCapability(capability)} key={capability} type="button">{capability}</button>)}</div> : null}
            </div>

            <footer className="listing-submit"><div><span>Starting at</span><strong>{formatMoney(draft.priceFrom)}</strong></div><button className="gradient-stroke-button" disabled={!validation.success} onClick={() => setSubmitted(true)} type="button">Submit for review</button></footer>
          </section>
        </div>
      </section>
    </main>
  );
}

function inferProductDraft(text: string, current: ProductDraftInput): ProductDraftInput {
  const normalized = text.toLowerCase();
  const category: ProductDraftInput["category"] = /trà|ấm|tea|teapot/.test(normalized) ? "Tea" : /bát|đĩa|tô|bowl|plate|tableware/.test(normalized) ? "Tableware" : /cốc|ly|cup|mug|drinkware/.test(normalized) ? "Drinkware" : "Decor";
  const material = /sứ|porcelain/.test(normalized) ? "Porcelain" : /đất nung|terracotta/.test(normalized) ? "Terracotta" : /gốm|stoneware|ceramic/.test(normalized) ? "Stoneware" : current.material;
  const finish = /men lam|cobalt|indigo/.test(normalized) ? "Cobalt glaze" : /men ngọc|celadon/.test(normalized) ? "Celadon glaze" : /men tro|ash glaze/.test(normalized) ? "Ash glaze" : /vẽ tay|hand.?painted/.test(normalized) ? "Hand-painted" : current.finish;
  const price = text.match(/(?:giá(?: từ)?|price|from|từ)\s*(\d+(?:[.,]\d+)?)/i);
  const minimum = text.match(/(?:tối thiểu|minimum|moq)\s*(\d+)/i);
  const lead = text.match(/(\d+)\s*[–-]\s*(\d+)\s*(?:ngày|days?)/i);
  const capabilities = [
    /logo/.test(normalized) ? "2D logo print" : null,
    /nổi|relief|3d/.test(normalized) ? "Raised 3D mark" : null,
    /khắc|engraving/.test(normalized) ? "Engraved text" : null,
    /họa tiết|motif/.test(normalized) ? "Custom motif" : null,
    /tên|name/.test(normalized) ? "Name personalization" : null,
    /lời chúc|message/.test(normalized) ? "Gift message" : null,
    /monogram/.test(normalized) ? "Monogram" : null,
  ].filter((item): item is string => Boolean(item));
  const firstSentence = text.split(/[.!?\n]/)[0].trim();
  const title = firstSentence.replace(/^(tôi (?:bán|làm)|mình (?:bán|làm)|we (?:make|sell))\s+/i, "").slice(0, 72);
  const story = text.trim().length >= 40 ? text.trim() : `${text.trim()} Handmade in small batches with careful attention to material and finish.`;

  return {
    ...current,
    title: title || current.title,
    category,
    material,
    finish,
    priceFrom: price ? Number(price[1].replace(",", ".")) : current.priceFrom,
    minimumOrderQuantity: minimum ? Number(minimum[1]) : current.minimumOrderQuantity,
    leadTimeMinDays: lead ? Number(lead[1]) : current.leadTimeMinDays,
    leadTimeMaxDays: lead ? Number(lead[2]) : current.leadTimeMaxDays,
    story,
    customizable: capabilities.length > 0 || /tùy chỉnh|custom/.test(normalized),
    customizationCapabilities: capabilities,
  };
}
