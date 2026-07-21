import { redirect } from "next/navigation";
import { products } from "@/src/data/products";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/app/products/${slug}`);
}
