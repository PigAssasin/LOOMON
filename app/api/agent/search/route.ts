import { NextResponse } from "next/server";
import { z } from "zod";
import { products } from "@/src/data/products";
import { recommendProducts } from "@/src/lib/recommend-products";

const searchSchema = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.coerce.number().int().min(1).max(12).default(6),
});

export async function POST(request: Request) {
  const input = searchSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "Invalid search request" }, { status: 400 });
  return NextResponse.json({ products: recommendProducts(products, input.data.query, input.data.limit) });
}
