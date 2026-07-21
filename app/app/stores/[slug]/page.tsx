import { notFound } from "next/navigation";
import { StorefrontExperience } from "@/src/features/store/storefront-experience";
import { getStoreBySlug, stores } from "@/src/data/stores";

export function generateStaticParams() {
  return stores.map((store) => ({ slug: store.slug }));
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = getStoreBySlug(slug);
  if (!store) notFound();
  return <StorefrontExperience store={store} />;
}
