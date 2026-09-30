import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSearchCriteria, PrismaProductRepository } from "../src/modules/product/product.repository.js";
import { mapProductRow } from "../src/modules/product/product.mapper.js";
import type { ProductRow } from "../src/modules/product/product.types.js";

function baseRow(): ProductRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    slug: "fixture",
    name: "Fixture",
    aliases: [],
    description: "A fixture row.",
    price: new Prisma.Decimal("1.00"),
    sellingLabel: "1 kg",
    sellingKind: "weight",
    stockStatus: "in_stock",
    imageUrl: null,
    images: [],
    origin: null,
    storage: null,
    preparation: null,
    nutrition: null,
    allergens: [],
    category: { id: "00000000-0000-0000-0000-000000000001", slug: "roots", name: "Roots", sortOrder: 1 },
  };
}

function mappedPriceIsPlainNumber(row: ProductRow): boolean {
  return typeof mapProductRow(row).price === "number";
}

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".env") });

const prisma = new PrismaClient();
const repository = new PrismaProductRepository(prisma);

const ALL: Parameters<typeof buildSearchCriteria> = [null, null, "price-asc"];

async function slugs(q: string | null, category: string | null = null, sort: "price-asc" | "price-desc" = "price-asc"): Promise<string[]> {
  const rows = await repository.findAll(buildSearchCriteria(q, category, sort));
  return rows.map((row) => row.slug);
}

beforeAll(async () => {
  await prisma.product.count();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("unfiltered and category-filtered listing", () => {
  it("returns every product when unfiltered", async () => {
    const rows = await repository.findAll(buildSearchCriteria(...ALL));

    expect(rows.length).toBe(37);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(rows.length);
  });

  it("returns only the requested category", async () => {
    const rows = await repository.findAll(buildSearchCriteria(null, "roots", "price-asc"));
    const categorySlugs = new Set(rows.map((row) => row.category.slug));

    expect(rows.length).toBeGreaterThan(0);
    expect([...categorySlugs]).toEqual(["roots"]);
  });

  it("includes out-of-stock products in the listing", async () => {
    const rows = await repository.findAll(buildSearchCriteria(...ALL));
    const statuses = rows.map((row) => row.stockStatus);

    expect(statuses).toContain("out_of_stock");
    expect(statuses).toContain("low_stock");
    expect(statuses).toContain("in_stock");
  });

  it("attaches the product's category to every row", async () => {
    const rows = await repository.findAll(buildSearchCriteria(...ALL));

    for (const row of rows) {
      expect(row.category.slug).toMatch(/^[a-z0-9-]+$/);
      expect(row.category.name).not.toBe("");
      expect(Number.isInteger(row.category.sortOrder)).toBe(true);
    }
  });
});

describe("search predicate", () => {
  it("matches case-insensitively", async () => {
    expect(await slugs("carrot")).toEqual(await slugs("CARROT"));
    expect(await slugs("CaRrOt")).toEqual(await slugs("carrot"));
  });

  it("requires every token, with AND across tokens", async () => {
    expect(await slugs("cherry tomato")).toEqual(["cherry-tomatoes"]);
    expect(await slugs("carrot nonsenseword")).toEqual([]);
  });

  it("keeps the shorter-token and longer-token asymmetry", async () => {
    expect(await slugs("carrot")).toContain("carrot");
    expect(await slugs("carrots")).toContain("carrot");
    expect(await slugs("carrot")).toContain("baby-carrots");
    expect(await slugs("potatoes")).not.toContain("potato");
  });

  it("resolves an alias to its canonical product", async () => {
    expect(await slugs("cilantro")).toEqual(["coriander"]);
    expect(await slugs("cilantro")).not.toContain("coriander2");
  });

  it("matches a plural through an alias on a singular-named product", async () => {
    expect(await slugs("carrots")).toContain("carrot");
    expect(await slugs("tomatoes")).toContain("tomato");
  });

  it("matches names as substrings but not stems", async () => {
    const withCarrot = await slugs("carrot");
    const withParsnip = await slugs("parsnip");

    expect(withCarrot.length).toBeGreaterThan(1);
    expect(withParsnip).toEqual([]);
  });
});

describe("price sorting", () => {
  it("orders ascending by default and descending on request", async () => {
    const ascending = await repository.findAll(buildSearchCriteria(null, null, "price-asc"));
    const descending = await repository.findAll(buildSearchCriteria(null, null, "price-desc"));

    const ascendingPrices = ascending.map((row) => Number(row.price));
    const descendingPrices = descending.map((row) => Number(row.price));

    expect([...ascendingPrices].sort((a, b) => a - b)).toEqual(ascendingPrices);
    expect([...descendingPrices].sort((a, b) => b - a)).toEqual(descendingPrices);
    expect(descending.map((row) => row.slug).slice().sort()).toEqual(ascending.map((row) => row.slug).slice().sort());
  });

  it("breaks equal prices by product name", async () => {
    const ascending = await repository.findAll(buildSearchCriteria(null, null, "price-asc"));
    const tied = ascending.filter((row) => Number(row.price) === 480).map((row) => row.name);

    expect(tied.length).toBeGreaterThanOrEqual(2);
    expect(tied).toEqual([...tied].sort());
  });

  it("sorts the filtered set, not the whole catalog", async () => {
    const filtered = await repository.findAll(buildSearchCriteria("carrot", null, "price-asc"));
    const prices = filtered.map((row) => Number(row.price));

    expect(filtered.length).toBeLessThan(37);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
});

describe("lookup and totals", () => {
  it("finds a known slug", async () => {
    const row = await repository.findBySlug("carrot");

    expect(row).not.toBeNull();
    expect(row?.name).toBe("Carrot");
    expect(row?.category.slug).toBe("roots");
  });

  it("yields no row for an unknown slug", async () => {
    expect(await repository.findBySlug("dragonfruit")).toBeNull();
    expect(await repository.findBySlug("")).toBeNull();
  });

  it("counts the whole catalog regardless of filters", async () => {
    expect(await repository.countAll()).toBe(37);
    expect(await repository.countAll()).toBe((await repository.findAll(buildSearchCriteria(...ALL))).length);
  });
});

describe("decimal price mapping", () => {
  it("maps the database decimal to a JSON number equal to the seeded price", async () => {
    const row = await repository.findBySlug("carrot");
    const mapped = mapProductRow(row as ProductRow);

    expect(typeof mapped.price).toBe("number");
    expect(mapped.price).toBe(480);
    expect(JSON.parse(JSON.stringify({ price: mapped.price }))).toEqual({ price: 480 });
  });

  it("converts the Prisma Decimal object rather than serializing it", async () => {
    const row = await repository.findBySlug("carrot");

    expect(typeof row?.price).toBe("object");
    expect(mappedPriceIsPlainNumber(row as ProductRow)).toBe(true);
  });

  it("preserves two-decimal precision rather than truncating to an integer", () => {
    const row = baseRow();
    const mapped = mapProductRow({ ...row, price: new Prisma.Decimal("4.80") });

    expect(mapped.price).toBe(4.8);
    expect(Number.isInteger(mapped.price)).toBe(false);
    expect(mapProductRow({ ...row, price: new Prisma.Decimal("1150.55") }).price).toBe(1150.55);
    expect(mapProductRow({ ...row, price: new Prisma.Decimal("0.05") }).price).toBe(0.05);
  });

  it("omits absent optional fields rather than emitting null", async () => {
    const row = await repository.findBySlug("water-spinach");
    const mapped = mapProductRow(row as ProductRow);

    expect(mapped.origin).toBeUndefined();
    expect(mapped.imageUrl).toBeUndefined();
    expect(JSON.parse(JSON.stringify(mapped))).not.toHaveProperty("origin");
  });
});