import type { Category, CategoryFacet } from "@catalog/product-contract";

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  productCount: number;
}

export interface CategoryFacetRow {
  slug: string;
  name: string;
  sortOrder: number;
  count: number;
}

export interface FacetCriteria {
  tokens: string[];
  excludeZeroCounts: boolean;
}

export interface CategoryRepository {
  findAllWithCounts(): Promise<CategoryRow[]>;
  findFacets(criteria: FacetCriteria): Promise<CategoryFacetRow[]>;
  existsBySlug(slug: string): Promise<boolean>;
}

export type { Category, CategoryFacet };