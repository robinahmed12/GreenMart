import { describe, expect, it } from "vitest";
import { productQuerySchema, productSchema, sellingUnitSchema } from "../src/modules/product/product.schema.js";
import { MAX_QUERY_LENGTH } from "@catalog/product-contract";

const validProduct = {
  slug: "carrot",
  name: "Carrot",
  aliases: ["carrots"],
  description: "Sweet, crisp roots.",
  price: 480,
  sellingUnit: { label: "500 g", kind: "weight" },
  stockStatus: "in_stock",
  category: { slug: "roots", name: "Roots", sortOrder: 1 },
};

describe("product response schema", () => {
  it("accepts a complete product", () => {
    expect(productSchema.parse(validProduct)).toEqual(validProduct);
  });

  it.each(["name", "description", "price", "sellingUnit", "stockStatus", "category", "slug"])(
    "rejects a product missing the required field %s",
    (field) => {
      const incomplete: Record<string, unknown> = { ...validProduct };
      delete incomplete[field];

      expect(productSchema.safeParse(incomplete).success).toBe(false);
    },
  );

  it("rejects a non-positive price", () => {
    expect(productSchema.safeParse({ ...validProduct, price: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, price: -1 }).success).toBe(false);
  });

  it("rejects an unsupported selling unit kind or stock status", () => {
    expect(productSchema.safeParse({ ...validProduct, sellingUnit: { label: "1 L", kind: "volume" } }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, stockStatus: "preorder" }).success).toBe(false);
  });

  it("rejects a blank selling unit label", () => {
    expect(sellingUnitSchema.safeParse({ label: "", kind: "weight" }).success).toBe(false);
  });

  it("treats every optional detail field as optional", () => {
    for (const field of ["imageUrl", "images", "origin", "storage", "preparation", "nutrition", "allergens"]) {
      expect(productSchema.safeParse(validProduct).success).toBe(true);
      expect(field in validProduct).toBe(false);
    }
  });
});

describe("listing parameter schema", () => {
  it("allows all parameters to be absent", () => {
    expect(productQuerySchema.parse({})).toEqual({});
  });

  it("accepts the supported sort values", () => {
    expect(productQuerySchema.parse({ sort: "price-asc" }).sort).toBe("price-asc");
    expect(productQuerySchema.parse({ sort: "price-desc" }).sort).toBe("price-desc");
  });

  it("rejects an unknown sort value", () => {
    const result = productQuerySchema.safeParse({ sort: "cheapest" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["sort"]);
  });

  it("rejects a search query longer than the defined maximum", () => {
    const atLimit = "a".repeat(MAX_QUERY_LENGTH);
    const overLimit = "a".repeat(MAX_QUERY_LENGTH + 1);

    expect(productQuerySchema.safeParse({ q: atLimit }).success).toBe(true);
    expect(productQuerySchema.safeParse({ q: overLimit }).success).toBe(false);
  });
});