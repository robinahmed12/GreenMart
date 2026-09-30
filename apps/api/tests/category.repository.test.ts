import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCategoryRepository } from "../src/modules/category/category.repository.js";
import { categoryListSchema } from "../src/modules/category/category.schema.js";

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".env") });

const prisma = new PrismaClient();
const repository = new PrismaCategoryRepository(prisma);

beforeAll(async () => {
  await prisma.product.count();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("category listing", () => {
  it("returns every populated category in ascending display order", async () => {
    const rows = await repository.findAllWithCounts();
    const orders = rows.map((row) => row.sortOrder);

    expect(rows.length).toBe(7);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(rows.map((row) => row.slug)).toEqual([
      "leafy-greens",
      "roots",
      "stems",
      "fruiting",
      "alliums",
      "mushrooms",
      "herbs",
    ]);
  });

  it("is ordered by display order, not alphabetically", async () => {
    const rows = await repository.findAllWithCounts();
    const slugs = rows.map((row) => row.slug);

    expect(slugs).not.toEqual([...slugs].sort());
  });

  it("reports a product count per category", async () => {
    const rows = await repository.findAllWithCounts();
    const total = rows.reduce((sum, row) => sum + row.productCount, 0);

    expect(await prisma.product.count()).toBe(total);
    expect(rows.every((row) => row.productCount > 0)).toBe(true);
  });

  it("satisfies the category response schema", () => {
    return repository.findAllWithCounts().then((rows) => {
      expect(categoryListSchema.safeParse({ data: rows }).success).toBe(true);
    });
  });
});

describe("facet counts", () => {
  it("ignores the requested category restriction, so a count stays honest", async () => {
    const forCarrotOnly = await repository.findFacets({ tokens: ["carrot"], excludeZeroCounts: true });

    expect(forCarrotOnly.map((facet) => facet.slug)).toEqual(["roots"]);

    const all = await repository.findFacets({ tokens: ["carrot"], excludeZeroCounts: false });
    expect(all.length).toBe(7);
    expect(all.filter((facet) => facet.count > 0).map((facet) => facet.slug)).toEqual(["roots"]);
  });

  it("reports the selected category's own count as the number of products returned", async () => {
    const selected = await repository.findFacets({ tokens: ["carrot"], excludeZeroCounts: true });
    const rootsFacet = selected.find((facet) => facet.slug === "roots");

    expect(rootsFacet?.count).toBe(2);
  });

  it("can include zero-count categories when asked", async () => {
    const all = await repository.findFacets({ tokens: ["dragonfruit"], excludeZeroCounts: false });

    expect(all.length).toBe(7);
    expect(all.every((facet) => facet.count === 0)).toBe(true);
  });

  it("counts every category when no search is active", async () => {
    const facets = await repository.findFacets({ tokens: [], excludeZeroCounts: true });

    expect(facets.length).toBe(7);
    expect(facets.reduce((sum, facet) => sum + facet.count, 0)).toBe(37);
  });

  it("narrows counts to the active search", async () => {
    const facets = await repository.findFacets({ tokens: ["carrot"], excludeZeroCounts: true });
    const bySlug = new Map(facets.map((facet) => [facet.slug, facet.count]));

    expect(bySlug.get("roots")).toBe(2);
    expect([...bySlug.values()].every((count) => count > 0)).toBe(true);
  });

  it("omits categories with no matching product", async () => {
    const facets = await repository.findFacets({ tokens: ["dragonfruit"], excludeZeroCounts: true });

    expect(facets).toEqual([]);
  });

  it("keeps display order on facets", async () => {
    const facets = await repository.findFacets({ tokens: [], excludeZeroCounts: true });
    const orders = facets.map((facet) => facet.sortOrder);

    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it("applies AND across multiple search tokens", async () => {
    const facets = await repository.findFacets({ tokens: ["cherry", "tomato"], excludeZeroCounts: true });

    expect(facets.map((facet) => facet.slug)).toEqual(["fruiting"]);
  });
});

describe("category existence", () => {
  it("recognises an existing category", async () => {
    expect(await repository.existsBySlug("roots")).toBe(true);
  });

  it("rejects an unknown category", async () => {
    expect(await repository.existsBySlug("bogus")).toBe(false);
    expect(await repository.existsBySlug("")).toBe(false);
  });
});