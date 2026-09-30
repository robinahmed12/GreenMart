import { Prisma, type PrismaClient } from "@prisma/client";
import type { CategoryFacetRow, CategoryRepository, CategoryRow, FacetCriteria } from "./category.types.js";

export function createCategoryRepository(prisma: PrismaClient): CategoryRepository {
  return new PrismaCategoryRepository(prisma);
}

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAllWithCounts(): Promise<CategoryRow[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; slug: string; name: string; sortOrder: number; productCount: bigint }>>(Prisma.sql`
      SELECT c.id, c.slug, c.name, c.sort_order AS "sortOrder",
             count(p.id)::bigint AS "productCount"
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.slug, c.name, c.sort_order
      HAVING count(p.id) > 0
      ORDER BY c.sort_order ASC
    `);

    return rows.map((row) => ({ ...row, productCount: Number(row.productCount) }));
  }

  async findFacets(criteria: FacetCriteria): Promise<CategoryFacetRow[]> {
    const conditions: Prisma.Sql[] = [];

    for (const token of criteria.tokens) {
      const pattern = `%${token}%`;
      conditions.push(
        Prisma.sql`(p.name ILIKE ${pattern} OR array_to_string(p.aliases, ' ') ILIKE ${pattern})`,
      );
    }

    const searchJoin =
      conditions.length === 0 ? Prisma.sql`` : Prisma.sql` AND ${Prisma.join(conditions, " AND ")}`;
    const having = criteria.excludeZeroCounts ? Prisma.sql`HAVING count(p.id) > 0` : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<Array<{ slug: string; name: string; sortOrder: number; count: bigint }>>(Prisma.sql`
      SELECT c.slug, c.name, c.sort_order AS "sortOrder", count(p.id)::bigint AS count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id${searchJoin}
      GROUP BY c.id, c.slug, c.name, c.sort_order
      ${having}
      ORDER BY c.sort_order ASC
    `);

    return rows.map((row) => ({ slug: row.slug, name: row.name, sortOrder: row.sortOrder, count: Number(row.count) }));
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ exists: boolean }>>(
      Prisma.sql`SELECT EXISTS (SELECT 1 FROM categories WHERE slug = ${slug}) AS exists`,
    );

    return rows[0]?.exists === true;
  }
}