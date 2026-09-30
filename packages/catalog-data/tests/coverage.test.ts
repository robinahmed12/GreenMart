import { describe, expect, it } from "vitest";
import {
  SELLING_UNIT_KINDS,
  STOCK_STATUSES,
  type SellingUnitKind,
  type StockStatus,
} from "@catalog/product-contract";
import { categories, findCatalogIssues, products } from "../src/index.js";

describe("category data", () => {
  it("is a flat list with a slug, display name, and explicit order", () => {
    expect(categories.length).toBeGreaterThan(0);

    for (const category of categories) {
      expect(category.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(category.name.trim()).not.toBe("");
      expect(Number.isInteger(category.sortOrder)).toBe(true);
      expect(Object.keys(category).sort()).toEqual(["name", "slug", "sortOrder"]);
    }
  });

  it("has an unambiguous, non-overlapping display order", () => {
    const orders = categories.map((category) => category.sortOrder);

    expect(new Set(orders).size).toBe(orders.length);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it("is not ordered by name or slug", () => {
    const byName = [...categories].map((c) => c.name);
    const bySlug = [...categories].map((c) => c.slug);

    expect(byName).not.toEqual([...byName].sort());
    expect(bySlug).not.toEqual([...bySlug].sort());
  });
});

describe("product coverage", () => {
  it("holds between 20 and 40 products", () => {
    expect(products.length).toBeGreaterThanOrEqual(20);
    expect(products.length).toBeLessThanOrEqual(40);
  });

  it("covers every selling unit kind", () => {
    const kinds = new Set<SellingUnitKind>(products.map((product) => product.sellingUnit.kind));

    for (const kind of SELLING_UNIT_KINDS) {
      expect(kinds).toContain(kind);
    }
  });

  it("covers every stock status, including at least one out-of-stock product", () => {
    const statuses = new Set<StockStatus>(products.map((product) => product.stockStatus));

    for (const status of STOCK_STATUSES) {
      expect(statuses).toContain(status);
    }
    expect(products.filter((product) => product.stockStatus === "out_of_stock").length).toBeGreaterThanOrEqual(1);
  });

  it("includes at least two products sharing a price, so price ties are exercised", () => {
    const byPrice = new Map<number, string[]>();

    for (const product of products) {
      const slugs = byPrice.get(product.price) ?? [];
      slugs.push(product.slug);
      byPrice.set(product.price, slugs);
    }

    const ties = [...byPrice.values()].filter((slugs) => slugs.length >= 2);
    expect(ties.length).toBeGreaterThanOrEqual(1);

    const tied = ties[0] ?? [];
    expect(new Set(tied).size).toBe(tied.length);
    expect([...byPrice.keys()].every(Number.isFinite)).toBe(true);
  });

  it("includes at least one product carrying aliases", () => {
    expect(products.filter((product) => product.aliases.length > 0).length).toBeGreaterThanOrEqual(1);
  });

  it("includes the plural form of a singular name, as both alias and product name", () => {
    const singulars = products.filter((product) =>
      product.aliases.some((alias) => `${product.name.trim().toLowerCase()}s` === alias.trim().toLowerCase()),
    );
    const pluralNames = products.filter((product) => product.name.trim().toLowerCase().endsWith("s"));

    expect(singulars.length).toBeGreaterThanOrEqual(1);
    expect(pluralNames.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps search asymmetric rather than stemmed: an unstemmed singular is not an alias of its plural", () => {
    const carrot = products.find((product) => product.slug === "carrot");
    const potato = products.find((product) => product.slug === "potato");

    expect(carrot?.aliases.map((alias) => alias.toLowerCase())).toContain("carrots");
    expect(potato?.aliases).not.toContain("potatoes");
    expect(potato?.name.toLowerCase()).not.toContain("potatoes");
  });

  it("places at least one product in every category, so no category is served empty", () => {
    const populated = new Set(products.map((product) => product.categorySlug));

    for (const category of categories) {
      expect(populated).toContain(category.slug);
    }
  });

  it("carries secondary detail on some products and leaves it absent on others", () => {
    const withImage = products.filter((product) => product.imageUrl !== undefined);
    const withoutSecondaryDetail = products.filter(
      (product) =>
        product.imageUrl === undefined &&
        product.origin === undefined &&
        product.storage === undefined &&
        product.nutrition === undefined,
    );

    expect(withImage.length).toBeGreaterThanOrEqual(1);
    expect(withoutSecondaryDetail.length).toBeGreaterThanOrEqual(1);
  });

  it("has every product pass integrity checks", () => {
    expect(findCatalogIssues(categories, products)).toEqual([]);
  });
});