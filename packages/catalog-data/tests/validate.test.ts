import { describe, expect, it } from "vitest";
import {
  CatalogIntegrityError,
  assertCatalogIntegrity,
  categories,
  findCatalogIssues,
  product,
  products,
} from "../src/index.js";
import { price } from "@catalog/product-contract";

const validProduct = product(
  "carrot",
  "Carrot",
  "roots",
  480,
  { label: "500 g", kind: "weight" },
  "in_stock",
  "A crisp orange root.",
);

describe("authored dataset", () => {
  it("passes its own integrity check", () => {
    expect(() => assertCatalogIntegrity(categories, products)).not.toThrow();
    expect(findCatalogIssues(categories, products)).toEqual([]);
  });
});

describe("integrity validation rejects invalid fixtures", () => {
  it.each([
    {
      name: "a duplicate product slug",
      categories,
      products: [validProduct, validProduct],
      expected: /duplicate product slug "carrot"/,
    },
    {
      name: "a product pointing at a category that does not exist",
      categories,
      products: [product("p", "P", "nonexistent", 100, { label: "1 kg", kind: "weight" }, "in_stock", "d")],
      expected: /category "nonexistent" is not in the category list/,
    },
    {
      name: "a blank product description",
      categories,
      products: [product("p", "P", "roots", 100, { label: "1 kg", kind: "weight" }, "in_stock", "   ")],
      expected: /product description must not be blank/,
    },
    {
      name: "a blank selling unit label",
      categories,
      products: [product("p", "P", "roots", 100, { label: "  ", kind: "weight" }, "in_stock", "d")],
      expected: /selling unit label must not be blank/,
    },
    {
      name: "a blank alias",
      categories,
      products: [product("p", "P", "roots", 100, { label: "1 kg", kind: "weight" }, "in_stock", "d", { aliases: [""] })],
      expected: /alias must not be blank/,
    },
    {
      name: "a repeated alias",
      categories,
      products: [product("p", "P", "roots", 100, { label: "1 kg", kind: "weight" }, "in_stock", "d", { aliases: ["x", "x"] })],
      expected: /alias "x" is repeated/,
    },
    {
      name: "an alias that merely repeats the product name",
      categories,
      products: [product("p", "Pumpkin", "roots", 100, { label: "1 kg", kind: "weight" }, "in_stock", "d", { aliases: ["pumpkin"] })],
      expected: /repeats the product name and adds no search value/,
    },
    {
      name: "a slug that is not lower-case and hyphenated",
      categories,
      products: [product("Bad_Slug", "P", "roots", 100, { label: "1 kg", kind: "weight" }, "in_stock", "d")],
      expected: /must be lower-case and hyphenated/,
    },
    {
      name: "two categories sharing a display order",
      categories: [
        { slug: "roots", name: "Roots", sortOrder: 1 },
        { slug: "herbs", name: "Herbs", sortOrder: 1 },
      ],
      products: [],
      expected: /display order is ambiguous/,
    },
    {
      name: "a duplicate category slug",
      categories: [
        { slug: "roots", name: "Roots", sortOrder: 1 },
        { slug: "roots", name: "Root Vegetables", sortOrder: 2 },
      ],
      products: [],
      expected: /duplicate category slug "roots"/,
    },
    {
      name: "a non-positive display order",
      categories: [{ slug: "roots", name: "Roots", sortOrder: 0 }],
      products: [],
      expected: /sortOrder must be a positive integer/,
    },
  ])("rejects $name", ({ categories: fixtureCategories, products: fixtureProducts, expected }) => {
    const issues = findCatalogIssues(fixtureCategories, fixtureProducts);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.map((issue) => issue.message).join("\n")).toMatch(expected);
    expect(() => assertCatalogIntegrity(fixtureCategories, fixtureProducts)).toThrow(CatalogIntegrityError);
  });

  it("reports every issue rather than only the first", () => {
    const issues = findCatalogIssues(
      [
        { slug: "Roots", name: "", sortOrder: -1 },
      ],
      [product("DUP", "N", "roots", 100, { label: "x", kind: "count" }, "in_stock", " ")],
    );

    expect(issues.length).toBeGreaterThan(3);
  });

  it("cannot be bypassed by casting a non-positive price past the price factory", () => {
    const smuggled = { ...validProduct, price: 0 as unknown as typeof validProduct.price };

    const issues = findCatalogIssues(categories, [smuggled]);

    expect(issues.map((issue) => issue.message)).toContain("price must be greater than zero, received 0");
  });

  it("rejects a price the factory itself refuses", () => {
    expect(() => price(0)).toThrow(RangeError);
  });
});