import { z } from "zod";

export const categorySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int(),
  productCount: z.number().int().nonnegative(),
});

export const categoryFacetSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int(),
  count: z.number().int().nonnegative(),
});

export const categoryListSchema = z.object({
  data: z.array(categorySchema),
});

export const categoryFacetsSchema = z.array(categoryFacetSchema);