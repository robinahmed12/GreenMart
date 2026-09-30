import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { MAX_QUERY_LENGTH } from "@catalog/product-contract";
import { buildTestApp, prisma } from "./helpers/app.js";

const app = buildTestApp();

beforeAll(async () => {
  await prisma.product.count();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/products with no parameters", () => {
  it("returns the whole catalog unpaginated with both counters", async () => {
    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(37);
    expect(response.body.meta.matched).toBe(37);
    expect(response.body.meta.catalogTotal).toBe(37);
  });

  it("returns no pagination controls or continuation token", async () => {
    const response = await request(app).get("/api/products");

    expect(response.body.meta).not.toHaveProperty("page");
    expect(response.body.meta).not.toHaveProperty("limit");
    expect(response.body.meta).not.toHaveProperty("nextCursor");
    expect(response.body).not.toHaveProperty("links");
  });

  it("defaults to ascending price", async () => {
    const response = await request(app).get("/api/products");
    const prices = response.body.data.map((product: { price: number }) => product.price);

    expect([...prices].sort((a: number, b: number) => a - b)).toEqual(prices);
  });
});

describe("search, category filtering, and sorting over HTTP", () => {
  it("applies search within a category", async () => {
    const response = await request(app).get("/api/products").query({ q: "carrot", category: "roots" });
    const slugs = response.body.data.map((product: { slug: string }) => product.slug);

    expect(response.status).toBe(200);
    expect(slugs.slice().sort()).toEqual(["baby-carrots", "carrot"]);
    expect(response.body.data.every((p: { category: { slug: string } }) => p.category.slug === "roots")).toBe(true);
  });

  it("applies AND semantics across tokens", async () => {
    const response = await request(app).get("/api/products").query({ q: "cherry tomato" });
    const slugs = response.body.data.map((product: { slug: string }) => product.slug);

    expect(slugs).toEqual(["cherry-tomatoes"]);
    expect(response.body.meta.matched).toBe(1);
    expect(response.body.meta.catalogTotal).toBe(37);
  });

  it("sorts the filtered set rather than the whole catalog", async () => {
    const ascending = await request(app).get("/api/products").query({ category: "roots", sort: "price-asc" });
    const descending = await request(app).get("/api/products").query({ category: "roots", sort: "price-desc" });

    const asc = ascending.body.data.map((p: { price: number }) => p.price);
    const desc = descending.body.data.map((p: { price: number }) => p.price);

    expect(asc.length).toBe(7);
    expect([...asc].sort((a: number, b: number) => a - b)).toEqual(asc);
    expect([...desc].sort((a: number, b: number) => b - a)).toEqual(desc);
  });

  it("breaks equal prices by name", async () => {
    const response = await request(app).get("/api/products");
    const tied = response.body.data.filter((p: { price: number }) => p.price === 480).map((p: { name: string }) => p.name);

    expect(tied).toEqual(["Bok Choy", "Carrot"]);
  });
});

describe("query parameter rejection", () => {
  it("rejects an unrecognized sort value naming the parameter", async () => {
    const response = await request(app).get("/api/products").query({ sort: "cheapest" });

    expect(response.status).toBe(400);
    expect(response.body.error.field).toBe("sort");
  });

  it("rejects an unknown category naming the parameter, without substituting a default", async () => {
    const response = await request(app).get("/api/products").query({ category: "bogus" });

    expect(response.status).toBe(400);
    expect(response.body.error.field).toBe("category");
    expect(response.body.data).toBeUndefined();
  });

  it("rejects an overlong query naming the parameter", async () => {
    const response = await request(app).get("/api/products").query({ q: "a".repeat(MAX_QUERY_LENGTH + 1) });

    expect(response.status).toBe(400);
    expect(response.body.error.field).toBe("q");
  });

  it("accepts a query exactly at the maximum length", async () => {
    const response = await request(app).get("/api/products").query({ q: "a".repeat(MAX_QUERY_LENGTH) });

    expect(response.status).toBe(200);
  });
});

describe("empty-state contract over HTTP", () => {
  it("distinguishes an empty catalog from a filter that matched nothing", async () => {
    const noMatch = await request(app).get("/api/products").query({ q: "dragonfruit" });

    expect(noMatch.status).toBe(200);
    expect(noMatch.body.data).toEqual([]);
    expect(noMatch.body.meta.matched).toBe(0);
    expect(noMatch.body.meta.catalogTotal).toBe(37);
    expect(noMatch.body.meta.catalogTotal).toBeGreaterThan(0);
  });
});

describe("facet options over HTTP", () => {
  it("reports category options with search-filtered counts", async () => {
    const response = await request(app).get("/api/products").query({ q: "carrot" });
    const categories = response.body.meta.categories;

    expect(categories.map((c: { slug: string }) => c.slug)).toEqual(["roots"]);
    expect(categories[0].count).toBe(2);
    expect(categories[0]).toMatchObject({ slug: "roots", name: "Roots", sortOrder: 2 });
  });

  it("omits zero-count categories from the reported options", async () => {
    const response = await request(app).get("/api/products").query({ q: "carrot" });
    const slugs = response.body.meta.categories.map((c: { slug: string }) => c.slug);

    expect(response.status).toBe(200);
    expect(slugs).not.toContain("herbs");
    expect(slugs).not.toContain("leafy-greens");
    expect(response.body.meta.categories.every((c: { count: number }) => c.count > 0)).toBe(true);
  });

  it("reports all seven populated categories when unfiltered", async () => {
    const response = await request(app).get("/api/products");
    const categories = response.body.meta.categories;

    expect(categories).toHaveLength(7);
    expect(categories.reduce((sum: number, c: { count: number }) => sum + c.count, 0)).toBe(37);
    expect(categories.every((c: { count: number }) => c.count > 0)).toBe(true);
  });

  it("omits the selected category when its own count is zero", async () => {
    const response = await request(app).get("/api/products").query({ category: "roots", q: "dragonfruit" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.categories).toEqual([]);
  });
});