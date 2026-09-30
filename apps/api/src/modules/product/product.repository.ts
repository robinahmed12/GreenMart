import { Prisma, type PrismaClient } from "@prisma/client";
import { tokenize } from "../../lib/index.js";
import type { ProductRepository, ProductRow, ProductSearchCriteria } from "./product.types.js";

const PRODUCT_COLUMNS = Prisma.sql`
  p.id, p.slug, p.name, p.aliases, p.description, p.price,
  p.selling_label AS "sellingLabel", p.selling_kind AS "sellingKind",
  p.stock_status AS "stockStatus", p.image_url AS "imageUrl", p.images,
  p.origin, p.storage, p.preparation, p.nutrition, p.allergens,
  c.id AS "categoryId", c.slug AS "categorySlug",
  c.name AS "categoryName", c.sort_order AS "categorySortOrder"
`;

type RawProductRow = Omit<ProductRow, "category"> & {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  categorySortOrder: number;
};

function attachCategory(row: RawProductRow): ProductRow {
  const { categoryId, categorySlug, categoryName, categorySortOrder, ...rest } = row;

  return {
    ...rest,
    category: { id: categoryId, slug: categorySlug, name: categoryName, sortOrder: categorySortOrder },
  };
}

function containsPattern(token: string): string {
  return `%${token}%`;
}

export function createProductRepository(prisma: PrismaClient): ProductRepository {
  return new PrismaProductRepository(prisma);
}

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(criteria: ProductSearchCriteria): Promise<ProductRow[]> {
    const conditions: Prisma.Sql[] = [];

    for (const token of criteria.tokens) {
      const pattern = containsPattern(token);
      conditions.push(
        Prisma.sql`(p.name ILIKE ${pattern} OR array_to_string(p.aliases, ' ') ILIKE ${pattern})`,
      );
    }

    if (criteria.categorySlug !== null) {
      conditions.push(Prisma.sql`c.slug = ${criteria.categorySlug}`);
    }

    const where = conditions.length === 0 ? Prisma.sql`` : Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
    const direction = Prisma.raw(criteria.sort === "price-desc" ? "DESC" : "ASC");

    const rows = await this.prisma.$queryRaw<RawProductRow[]>(Prisma.sql`
      SELECT ${PRODUCT_COLUMNS}
      FROM products p
      JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY p.price ${direction}, p.name ASC
    `);

    return rows.map(attachCategory);
  }

  async findBySlug(slug: string): Promise<ProductRow | null> {
    const rows = await this.prisma.$queryRaw<RawProductRow[]>(Prisma.sql`
      SELECT ${PRODUCT_COLUMNS}
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ${slug}
    `);

    const row = rows[0];
    return row === undefined ? null : attachCategory(row);
  }

  async countAll(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT count(*)::bigint AS count FROM products`,
    );
    return Number(rows[0]?.count ?? 0n);
  }
}

export function buildSearchCriteria(
  q: string | null,
  categorySlug: string | null,
  sort: "price-asc" | "price-desc",
): ProductSearchCriteria {
  return {
    tokens: q === null ? [] : tokenize(q),
    categorySlug,
    sort,
  };
}