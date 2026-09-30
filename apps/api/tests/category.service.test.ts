import { describe, expect, it } from "vitest";
import { AppError } from "../src/errors/index.js";
import { CategoryService } from "../src/modules/category/category.service.js";
import { stubCategoryRepository } from "./helpers/fakes.js";

function build() {
  const categories = stubCategoryRepository();
  categories.knownSlugs.add("roots");
  categories.categoriesToReturn = [
    { id: "1", slug: "leafy-greens", name: "Leafy Greens", sortOrder: 1, productCount: 7 },
    { id: "2", slug: "roots", name: "Roots", sortOrder: 2, productCount: 7 },
  ];
  return { categories, service: new CategoryService(categories) };
}

describe("category listing", () => {
  it("returns populated categories in display order with unfiltered counts", async () => {
    const { service, categories } = build();

    const result = await service.listCategories();

    expect(categories.allWithCountsCalls).toBe(1);
    expect(result).toEqual([
      { slug: "leafy-greens", name: "Leafy Greens", sortOrder: 1, productCount: 7 },
      { slug: "roots", name: "Roots", sortOrder: 2, productCount: 7 },
    ]);
    expect(result.every((category) => category.productCount > 0)).toBe(true);
  });
});

describe("category resolution", () => {
  it("resolves a known slug", async () => {
    const { service } = build();

    expect(await service.resolveCategory("roots")).toBe("roots");
  });

  it("raises INVALID_QUERY naming the category parameter for an unknown slug", async () => {
    const { service } = build();

    await expect(service.resolveCategory("bogus")).rejects.toBeInstanceOf(AppError);
    await expect(service.resolveCategory("bogus")).rejects.toMatchObject({
      status: 400,
      code: "INVALID_QUERY",
      field: "category",
    });
  });
});