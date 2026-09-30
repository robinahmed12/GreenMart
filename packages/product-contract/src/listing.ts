import type { CategoryFacet } from "./category.js";
import type { Product } from "./product.js";
import type { SortOrder } from "./primitives.js";

export interface ProductQuery {
  readonly q: string | null;
  readonly category: string | null;
  readonly sort: SortOrder;
}

export interface ListingMeta {
  readonly matched: number;
  readonly catalogTotal: number;
  readonly categories: readonly CategoryFacet[];
}

export interface ProductListing {
  readonly data: readonly Product[];
  readonly meta: ListingMeta;
}

export interface ProductDetail {
  readonly data: Product;
}