import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { ProductCollection } from "@/src/domain/collection";

export function CollectionCard({ collection, onSelect }: { collection: ProductCollection; onSelect: (collection: ProductCollection) => void }) {
  return (
    <article className="collection-card">
      <button type="button" onClick={() => onSelect(collection)} aria-label={`Explore ${collection.title}`}>
        <Image src={collection.image} alt="" fill sizes="(max-width: 700px) 100vw, 50vw" />
        <span className="collection-card-shade" />
        <span className="collection-card-copy">
          <small>Collection</small>
          <strong>{collection.title}</strong>
          <span>{collection.productSlugs.length} pieces <ArrowUpRight size={18} /></span>
        </span>
      </button>
    </article>
  );
}
