import { notFound } from "next/navigation";
import { getProductBySlug, products } from "@/src/data/products";
import { ProductDetailExperience } from "@/src/features/product/product-detail-experience";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();
  return <ProductDetailExperience product={product} />;
}
