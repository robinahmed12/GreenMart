import type { Category } from "@catalog/product-contract";
import { AppError } from "../../errors/index.js";
import type { CategoryRepository } from "../category/category.types.js";

export class CategoryService {
  constructor(private readonly categories: CategoryRepository) {}

  async listCategories(): Promise<Category[]> {
    const rows = await this.categories.findAllWithCounts();

    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      sortOrder: row.sortOrder,
      productCount: row.productCount,
    }));
  }

  async resolveCategory(slug: string): Promise<string> {
    const exists = await this.categories.existsBySlug(slug);

    if (!exists) {
      throw AppError.badRequest(`Unknown category "${slug}".`, "category");
    }

    return slug;
  }
}