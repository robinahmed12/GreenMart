import { DEFAULT_SORT_ORDER, type Product, type ProductListing, type SortOrder } from "@catalog/product-contract";
import { AppError } from "../../errors/index.js";
import { tokenize } from "../../lib/index.js";
import type { CategoryRepository } from "../category/category.types.js";
import { mapProductRow } from "./product.mapper.js";
import type { ProductRepository, ProductRow } from "./product.types.js";

export interface ListProductsInput {
  q?: string | undefined;
  category?: string | undefined;
  sort?: string | undefined;
}

export class ProductService {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async listProducts(input: ListProductsInput = {}): Promise<ProductListing> {
    const q = normalizeQuery(input.q);
    const sort = normalizeSort(input.sort);
    const tokens = q === null ? [] : tokenize(q);
    const categorySlug = await this.resolveCategory(input.category);

    const [rows, catalogTotal, facets] = await Promise.all([
      this.products.findAll({ tokens, categorySlug, sort }),
      this.products.countAll(),
      this.categories.findFacets({ tokens, excludeZeroCounts: true }),
    ]);

    const data: Product[] = rows.map((row) => mapProductRow(row as ProductRow));

    return {
      data,
      meta: {
        matched: data.length,
        catalogTotal,
        categories: facets
          .filter((facet) => facet.count > 0)
          .map((facet) => ({
            slug: facet.slug,
            name: facet.name,
            sortOrder: facet.sortOrder,
            count: facet.count,
          })),
      },
    };
  }

  async getProductBySlug(slug: string): Promise<Product> {
    const row = await this.products.findBySlug(slug);

    if (row === null) {
      throw AppError.notFound(`No product has the slug "${slug}".`);
    }

    return mapProductRow(row);
  }

  private async resolveCategory(requested: string | undefined): Promise<string | null> {
    if (requested === undefined) {
      return null;
    }

    const slug = requested.trim();

    if (slug === "") {
      throw AppError.badRequest("category must not be blank.", "category");
    }

    const exists = await this.categories.existsBySlug(slug);

    if (!exists) {
      throw AppError.badRequest(`Unknown category "${slug}".`, "category");
    }

    return slug;
  }
}

function normalizeQuery(q: string | undefined): string | null {
  if (q === undefined) {
    return null;
  }

  const trimmed = q.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeSort(sort: string | undefined): SortOrder {
  if (sort === undefined) {
    return DEFAULT_SORT_ORDER;
  }

  if (sort !== "price-asc" && sort !== "price-desc") {
    throw AppError.badRequest(`Unsupported sort "${sort}". Expected price-asc or price-desc.`, "sort");
  }

  return sort;
}