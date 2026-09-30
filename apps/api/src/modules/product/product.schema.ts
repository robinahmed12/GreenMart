import { MAX_QUERY_LENGTH, SELLING_UNIT_KINDS, SORT_ORDERS, STOCK_STATUSES } from "@catalog/product-contract";
import { z } from "zod";

export const categoryRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
});

export const sellingUnitSchema = z.object({
  label: z.string().min(1),
  kind: z.enum(SELLING_UNIT_KINDS),
});

export const productSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  description: z.string().min(1),
  price: z.number().positive(),
  sellingUnit: sellingUnitSchema,
  stockStatus: z.enum(STOCK_STATUSES),
  category: categoryRefSchema,
  imageUrl: z.string().optional(),
  images: z.array(z.string()).optional(),
  origin: z.string().optional(),
  storage: z.string().optional(),
  preparation: z.string().optional(),
  nutrition: z.string().optional(),
  allergens: z.array(z.string()).optional(),
});

export const productQuerySchema = z.object({
  q: z.string().max(MAX_QUERY_LENGTH).optional(),
  category: z.string().min(1).optional(),
  sort: z.enum(SORT_ORDERS).optional(),
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;