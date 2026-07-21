import { z } from "zod";

export const productDraftSchema = z.object({
  title: z.string().trim().min(3, "Add a product title"),
  category: z.enum(["Drinkware", "Tableware", "Decor", "Tea", "Gifts"]),
  story: z.string().trim().min(40, "Tell buyers more about the piece and how it is made"),
  material: z.string().trim().min(2, "Choose or add a material"),
  finish: z.string().trim().min(2, "Add the finish or color"),
  priceFrom: z.coerce.number().positive("Starting price must be above zero"),
  minimumOrderQuantity: z.coerce.number().int().positive("MOQ must be at least one"),
  leadTimeMinDays: z.coerce.number().int().positive(),
  leadTimeMaxDays: z.coerce.number().int().positive(),
  customizable: z.boolean(),
  customizationCapabilities: z.array(z.string()),
}).refine((data) => data.leadTimeMaxDays >= data.leadTimeMinDays, {
  message: "Maximum lead time must be equal to or longer than minimum lead time",
  path: ["leadTimeMaxDays"],
});

export type ProductDraftInput = z.infer<typeof productDraftSchema>;

export function validateProductDraft(input: ProductDraftInput) {
  return productDraftSchema.safeParse(input);
}
