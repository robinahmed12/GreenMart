import { describe, expect, it } from "vitest";
import { AppError } from "../src/errors/index.js";
import { ProductService } from "../src/modules/product/product.service.js";
import { makeRow, stubCategoryRepository, stubProductRepository } from "./helpers/fakes.js";

function build() {
  const products = stubProductRepository();
  const categories = stubCategoryRepository();
  categories.knownSlugs.add("roots");
  categories.facetsToReturn = [
    { slug: "roots", name: "Roots", sortOrder: 2, count: 2 },
    { slug: "herbs", name: "Herbs", sortOrder: 7, count: 0 },
  ];
  return { products, categories, service: new ProductService(products, categories) };
}

describe("listing composition", () => {
  it("applies defaults when no parameters are supplied", async () => {
    const { service, products, categories } = build();
    products.rowsToReturn = [makeRow()];

    const listing = await service.listProducts();

    expect(products.calls[0]).toEqual({ tokens: [], categorySlug: null, sort: "price-asc" });
    expect(categories.facetCalls[0]).toEqual({ tokens: [], excludeZeroCounts: true });
    expect(listing.meta.catalogTotal).toBe(37);
    expect(listing.meta.matched).toBe(1);
    expect(listing.data[0]?.slug).toBe("carrot");
  });

  it("applies AND semantics between search and category, and passes sort through", async () => {
    const { service, products, categories } = build();
    categories.knownSlugs.add("leafy-greens");

    await service.listProducts({ q: "cherry tomato", category: "leafy-greens", sort: "price-desc" });

    expect(products.calls[0]).toEqual({
      tokens: ["cherry", "tomato"],
      categorySlug: "leafy-greens",
      sort: "price-desc",
    });
    expect(categories.facetCalls[0]?.tokens).toEqual(["cherry", "tomato"]);
  });

  it("trims and treats an empty query as absent", async () => {
    const { service, products } = build();

    await service.listProducts({ q: "   " });

    expect(products.calls[0]?.tokens).toEqual([]);
  });

  it("rejects an unknown category without substituting a default", async () => {
    const { service, products } = build();

    await expect(service.listProducts({ category: "bogus" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_QUERY",
      field: "category",
    });
    expect(products.calls).toHaveLength(0);
  });

  it("rejects an unsupported sort value", async () => {
    const { service } = build();

    await expect(service.listProducts({ sort: "cheapest" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_QUERY",
      field: "sort",
    });
  });

  it("omits categories whose facet count is zero", async () => {
    const { service } = build();

    const listing = await service.listProducts();

    expect(listing.meta.categories).toEqual([{ slug: "roots", name: "Roots", sortOrder: 2, count: 2 }]);
    expect(listing.meta.categories.map((facet) => facet.slug)).not.toContain("herbs");
  });

  it("omits the selected category too when its own count is zero", async () => {
    const { service, categories } = build();
    categories.facetsToReturn = [{ slug: "roots", name: "Roots", sortOrder: 2, count: 0 }];

    const listing = await service.listProducts({ category: "roots", q: "dragonfruit" });

    expect(listing.data).toEqual([]);
    expect(listing.meta.matched).toBe(0);
    expect(listing.meta.categories).toEqual([]);
  });

  it("keeps facet options in display order", async () => {
    const { service, categories } = build();
    categories.facetsToReturn = [
      { slug: "leafy-greens", name: "Leafy Greens", sortOrder: 1, count: 7 },
      { slug: "roots", name: "Roots", sortOrder: 2, count: 2 },
      { slug: "herbs", name: "Herbs", sortOrder: 7, count: 3 },
    ];

    const listing = await service.listProducts();

    expect(listing.meta.categories.map((facet) => facet.sortOrder)).toEqual([1, 2, 7]);
  });
});

describe("product lookup by slug", () => {
  it("returns a found product unchanged", async () => {
    const { service, products } = build();
    products.bySlug.set("carrot", makeRow({ name: "Carrot", aliases: ["carrots"] }));

    const product = await service.getProductBySlug("carrot");

    expect(product.slug).toBe("carrot");
    expect(product.name).toBe("Carrot");
    expect(product.aliases).toEqual(["carrots"]);
    expect(product.price).toBe(480);
  });

  it("translates an absent result into PRODUCT_NOT_FOUND", async () => {
    const { service } = build();

    await expect(service.getProductBySlug("dragonfruit")).rejects.toBeInstanceOf(AppError);
    await expect(service.getProductBySlug("dragonfruit")).rejects.toMatchObject({
      status: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });
});

describe("empty-state composition", () => {
  it("distinguishes an empty catalog from a filter that matched nothing", async () => {
    const emptyCatalog = build();
    emptyCatalog.products.totalToReturn = 0;
    emptyCatalog.categories.facetsToReturn = [];

    const emptyListing = await emptyCatalog.service.listProducts({ q: "carrot" });
    expect(emptyListing.data).toEqual([]);
    expect(emptyListing.meta.matched).toBe(0);
    expect(emptyListing.meta.catalogTotal).toBe(0);

    const noMatches = build();
    noMatches.products.totalToReturn = 37;
    noMatches.products.rowsToReturn = [];
    noMatches.categories.facetsToReturn = [];

    const noMatchListing = await noMatches.service.listProducts({ q: "dragonfruit" });
    expect(noMatchListing.data).toEqual([]);
    expect(noMatchListing.meta.matched).toBe(0);
    expect(noMatchListing.meta.catalogTotal).toBe(37);
  });
});