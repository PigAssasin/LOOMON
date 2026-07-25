import { notFound } from "next/navigation";
import { getProductBySlug } from "@/src/data/products";
import { QuoteRequestExperience } from "@/src/features/quote/quote-request-experience";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: slug } = await searchParams;
  const product = slug ? getProductBySlug(slug) : undefined;
  if (!product) notFound();

  return <QuoteRequestExperience product={product} />;
}
