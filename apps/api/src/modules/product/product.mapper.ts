import type { SELLING_UNIT_KINDS, STOCK_STATUSES, Product } from "@catalog/product-contract";
import { toNumber } from "../../lib/index.js";
import { productSchema } from "./product.schema.js";
import type { ProductRow } from "./product.types.js";

export function mapProductRow(row: ProductRow): Product {
  const category = {
    slug: row.category.slug,
    name: row.category.name,
    sortOrder: row.category.sortOrder,
  };

  const product: { -readonly [K in keyof Product]: Product[K] } = {
    slug: row.slug,
    name: row.name,
    aliases: row.aliases,
    description: row.description,
    price: toNumber(row.price),
    sellingUnit: {
      label: row.sellingLabel,
      kind: row.sellingKind as (typeof SELLING_UNIT_KINDS)[number],
    },
    stockStatus: row.stockStatus as (typeof STOCK_STATUSES)[number],
    category,
  };

  if (row.imageUrl !== null) {
    product.imageUrl = row.imageUrl;
  }
  if (row.images.length > 0) {
    product.images = row.images;
  }
  if (row.origin !== null) {
    product.origin = row.origin;
  }
  if (row.storage !== null) {
    product.storage = row.storage;
  }
  if (row.preparation !== null) {
    product.preparation = row.preparation;
  }
  if (row.nutrition !== null) {
    product.nutrition = row.nutrition;
  }
  if (row.allergens.length > 0) {
    product.allergens = row.allergens;
  }

  return productSchema.parse(product);
}