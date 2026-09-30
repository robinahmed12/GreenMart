import type { Product as ContractProduct } from "@catalog/product-contract";

export type Product = ContractProduct;

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  description: string;
  price: unknown;
  sellingLabel: string;
  sellingKind: string;
  stockStatus: string;
  imageUrl: string | null;
  images: string[];
  origin: string | null;
  storage: string | null;
  preparation: string | null;
  nutrition: string | null;
  allergens: string[];
  category: {
    id: string;
    slug: string;
    name: string;
    sortOrder: number;
  };
}

export interface ProductSearchCriteria {
  tokens: string[];
  categorySlug: string | null;
  sort: "price-asc" | "price-desc";
}

export interface ProductRepository {
  findAll(criteria: ProductSearchCriteria): Promise<ProductRow[]>;
  findBySlug(slug: string): Promise<ProductRow | null>;
  countAll(): Promise<number>;
}