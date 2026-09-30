import type { CategoryFacetRow, CategoryRepository, CategoryRow } from "../../src/modules/category/category.types.js";
import type { ProductRepository, ProductRow, ProductSearchCriteria } from "../../src/modules/product/product.types.js";

export const ALL_SLUGS = [
  "carrot",
  "baby-carrots",
  "potato",
  "bok-choy",
  "tomato",
  "cherry-tomatoes",
  "cucumber",
  "water-spinach",
  "ginger",
];

export function makeRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: `id-${overrides.slug ?? "carrot"}`,
    slug: overrides.slug ?? "carrot",
    name: overrides.name ?? "Carrot",
    aliases: overrides.aliases ?? [],
    description: overrides.description ?? "Sweet, crisp roots.",
    price: overrides.price ?? 480,
    sellingLabel: overrides.sellingLabel ?? "500 g",
    sellingKind: overrides.sellingKind ?? "weight",
    stockStatus: overrides.stockStatus ?? "in_stock",
    imageUrl: overrides.imageUrl ?? null,
    images: overrides.images ?? [],
    origin: overrides.origin ?? null,
    storage: overrides.storage ?? null,
    preparation: overrides.preparation ?? null,
    nutrition: overrides.nutrition ?? null,
    allergens: overrides.allergens ?? [],
    category: overrides.category ?? { id: "cat-roots", slug: "roots", name: "Roots", sortOrder: 2 },
  };
}

export interface ProductRepositoryStub extends ProductRepository {
  calls: ProductSearchCriteria[];
  countCalls: number;
  slugLookups: string[];
  rowsToReturn: ProductRow[];
  totalToReturn: number;
  bySlug: Map<string, ProductRow | null>;
}

export function stubProductRepository(): ProductRepositoryStub {
  const stub: ProductRepositoryStub = {
    calls: [],
    countCalls: 0,
    slugLookups: [],
    rowsToReturn: [],
    totalToReturn: 37,
    bySlug: new Map(),

    async findAll(criteria: ProductSearchCriteria): Promise<ProductRow[]> {
      stub.calls.push(criteria);
      return stub.rowsToReturn;
    },

    async findBySlug(slug: string): Promise<ProductRow | null> {
      stub.slugLookups.push(slug);
      return stub.bySlug.get(slug) ?? null;
    },

    async countAll(): Promise<number> {
      stub.countCalls += 1;
      return stub.totalToReturn;
    },
  };

  return stub;
}

export interface CategoryRepositoryStub extends CategoryRepository {
  facetCalls: Array<{ tokens: string[]; excludeZeroCounts: boolean }>;
  facetsToReturn: CategoryFacetRow[];
  knownSlugs: Set<string>;
  categoriesToReturn: CategoryRow[];
  allWithCountsCalls: number;
}

export function stubCategoryRepository(): CategoryRepositoryStub {
  const stub: CategoryRepositoryStub = {
    facetCalls: [],
    facetsToReturn: [],
    knownSlugs: new Set(),
    categoriesToReturn: [],
    allWithCountsCalls: 0,

    async findAllWithCounts(): Promise<CategoryRow[]> {
      stub.allWithCountsCalls += 1;
      return stub.categoriesToReturn;
    },

    async findFacets(criteria): Promise<CategoryFacetRow[]> {
      stub.facetCalls.push({ tokens: criteria.tokens, excludeZeroCounts: criteria.excludeZeroCounts });
      return stub.facetsToReturn;
    },

    async existsBySlug(slug: string): Promise<boolean> {
      return stub.knownSlugs.has(slug);
    },
  };

  return stub;
}