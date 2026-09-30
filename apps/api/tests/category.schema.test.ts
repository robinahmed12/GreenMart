import { describe, expect, it } from "vitest";
import { categoryFacetSchema, categoryListSchema, categorySchema } from "../src/modules/category/category.schema.js";

const validCategory = { slug: "roots", name: "Roots", sortOrder: 2, productCount: 7 };
const validFacet = { slug: "roots", name: "Roots", sortOrder: 2, count: 2 };

describe("category response schema", () => {
  it("accepts a category carrying slug, name, and display order", () => {
    expect(categorySchema.parse(validCategory)).toEqual(validCategory);
  });

  it.each(["slug", "name", "sortOrder", "productCount"])("rejects a category missing %s", (field) => {
    const incomplete: Record<string, unknown> = { ...validCategory };
    delete incomplete[field];

    expect(categorySchema.safeParse(incomplete).success).toBe(false);
  });

  it("rejects a negative or fractional count", () => {
    expect(categorySchema.safeParse({ ...validCategory, productCount: -1 }).success).toBe(false);
    expect(categorySchema.safeParse({ ...validCategory, productCount: 1.5 }).success).toBe(false);
  });

  it("validates the wrapped category list", () => {
    expect(categoryListSchema.safeParse({ data: [validCategory] }).success).toBe(true);
    expect(categoryListSchema.safeParse({ data: [{}] }).success).toBe(false);
  });

  it("validates a facet", () => {
    expect(categoryFacetSchema.safeParse(validFacet).success).toBe(true);
    expect(categoryFacetSchema.safeParse({ ...validFacet, count: -1 }).success).toBe(false);
  });
});