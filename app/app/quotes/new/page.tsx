import { notFound, redirect } from "next/navigation";
import { getProductBySlug } from "@/src/data/products";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: slug } = await searchParams;
  const product = slug ? getProductBySlug(slug) : undefined;
  if (!product) notFound();

  redirect(`/app/products/${product.slug}?customize=1`);
}
