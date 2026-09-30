import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, prisma } from "./helpers/app.js";

const app = buildTestApp();

beforeAll(async () => {
  await prisma.product.count();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/products/:slug", () => {
  it("returns every required field for a known slug", async () => {
    const response = await request(app).get("/api/products/bok-choy");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      slug: "bok-choy",
      name: "Bok Choy",
      price: 480,
      sellingUnit: { kind: "bunch", label: "1 bunch" },
      stockStatus: "in_stock",
      category: { slug: "leafy-greens", name: "Leafy Greens" },
    });
    expect(response.body.data.description).toBeTruthy();
    expect(response.body.data.sellingUnit.label).toBeTruthy();
    expect(response.body.data.aliases).toEqual(expect.any(Array));
    expect(response.body.data.category.sortOrder).toBe(1);
    expect(response.body.data.stockStatus).toBe("in_stock");
  });

  it("returns numeric prices rather than strings", async () => {
    const response = await request(app).get("/api/products/bok-choy");

    expect(typeof response.body.data.price).toBe("number");
  });

  it("serves an out-of-stock product in full with its stock status", async () => {
    const response = await request(app).get("/api/products/okra");

    expect(response.status).toBe(200);
    expect(response.body.data.stockStatus).toBe("out_of_stock");
    expect(response.body.data.name).toBe("Okra");
    expect(response.body.data.description).toBeTruthy();
    expect(response.body.data.category.slug).toBe("fruiting");
  });

  it("serves the primary image for a seeded product that has one", async () => {
    const response = await request(app).get("/api/products/carrot");

    expect(response.body.data.imageUrl).toEqual(expect.any(String));
    expect(response.body.data.storage).toEqual(expect.any(String));
  });

  it("omits absent optional detail rather than sending nulls", async () => {
    const withDetail = await request(app).get("/api/products/bok-choy");
    const withoutDetail = await request(app).get("/api/products/okra");

    expect(withDetail.body.data).toHaveProperty("storage");
    expect(withDetail.body.data).toHaveProperty("nutrition");
    expect(withoutDetail.body.data).not.toHaveProperty("storage");
    expect(withoutDetail.body.data).not.toHaveProperty("nutrition");
    expect(withoutDetail.body.data).not.toHaveProperty("origin");
    expect(withoutDetail.body.data).not.toHaveProperty("imageUrl");
  });

  it("returns a 404 envelope for an unknown slug with no redirect", async () => {
    const response = await request(app).get("/api/products/not-a-real-product");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "PRODUCT_NOT_FOUND", message: expect.any(String) },
    });
    expect(response.headers.location).toBeUndefined();
    expect(response.body.data).toBeUndefined();
  });

  it("returns a 404 for a syntactically invalid slug rather than a 500", async () => {
    const response = await request(app).get("/api/products/Not_A_Slug");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY");
    expect(response.body.error.field).toBe("slug");
  });

  it("does not treat a category slug as a product slug", async () => {
    const response = await request(app).get("/api/products/roots");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });
});

describe("GET /api/categories", () => {
  it("returns populated categories in display order with counts", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body.data.map((c: { sortOrder: number }) => c.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(response.body.data.map((c: { slug: string }) => c.slug)).toEqual([
      "leafy-greens",
      "roots",
      "stems",
      "fruiting",
      "alliums",
      "mushrooms",
      "herbs",
    ]);
  });

  it("sums the counts to the catalog total", async () => {
    const response = await request(app).get("/api/categories");
    const total = response.body.data.reduce((sum: number, c: { productCount: number }) => sum + c.productCount, 0);

    expect(total).toBe(37);
  });

  it("omits an empty category", async () => {
    const response = await request(app).get("/api/categories");
    const slugs = response.body.data.map((c: { slug: string }) => c.slug);

    expect(slugs).not.toContain("deleted-category");
    expect(response.body.data.every((c: { productCount: number }) => c.productCount > 0)).toBe(true);
  });

  it("returns unfiltered counts even when products are filtered elsewhere", async () => {
    const [unfiltered, filtered] = await Promise.all([
      request(app).get("/api/categories"),
      request(app).get("/api/products").query({ q: "carrot" }),
    ]);
    const unfilteredRoots = unfiltered.body.data.find((c: { slug: string }) => c.slug === "roots");
    const filteredRoots = filtered.body.meta.categories.find((c: { slug: string }) => c.slug === "roots");

    expect(unfilteredRoots.productCount).toBe(7);
    expect(filteredRoots.count).toBe(2);
  });
});

describe("the API exposes no write surface", () => {
  const writeMethods = ["post", "put", "patch", "delete"] as const;

  it.each(writeMethods)("rejects %s on the product collection", async (method) => {
    const response = await request(app)[method]("/api/products");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it.each(writeMethods)("rejects %s on a product detail path", async (method) => {
    const response = await request(app)[method]("/api/products/bok-choy");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it.each(writeMethods)("rejects %s on the category collection", async (method) => {
    const response = await request(app)[method]("/api/categories");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("modifies no product or stock row after attempting writes", async () => {
    const before = await prisma.product.findMany({ orderBy: { slug: "asc" }, select: { slug: true, stockStatus: true, price: true } });

    await request(app).post("/api/products").send({ name: "Injected" });
    await request(app).patch("/api/products/bok-choy").send({ stockStatus: "in_stock", price: 1 });
    await request(app).delete("/api/products/bok-choy");

    const after = await prisma.product.findMany({ orderBy: { slug: "asc" }, select: { slug: true, stockStatus: true, price: true } });

    expect(after).toEqual(before);
    expect(await prisma.product.count()).toBe(37);
    expect(await prisma.product.count({ where: { name: "Injected" } })).toBe(0);
  });

  it("leaves stock statuses unchanged after serving the full read surface", async () => {
    const before = await prisma.product.groupBy({ by: ["stockStatus"], _count: { _all: true } });

    await request(app).get("/api/products");
    await request(app).get("/api/products?q=carrot");
    await request(app).get("/api/products/bok-choy");
    await request(app).get("/api/categories");

    const after = await prisma.product.groupBy({ by: ["stockStatus"], _count: { _all: true } });

    expect(after).toEqual(before);
  });
});