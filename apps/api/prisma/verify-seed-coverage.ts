import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function section(title: string): void {
  console.log(`\n-- ${title} --`);
}

async function main(): Promise<void> {
  section("row counts");
  for (const [label, sql] of [
    ["products", "select count(*) from products"],
    ["categories", "select count(*) from categories"],
    ["distinct product slugs", "select count(distinct slug) from products"],
    ["distinct category slugs", "select count(distinct slug) from categories"],
  ] as const) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(sql);
    console.log(`${label.padEnd(24)} ${rows[0]?.["count"]}`);
  }

  section("selling unit kinds present");
  const kinds = await prisma.product.groupBy({ by: ["sellingKind"], _count: { _all: true } });
  for (const k of kinds.sort((a, b) => a.sellingKind.localeCompare(b.sellingKind))) {
    console.log(`${k.sellingKind.padEnd(24)} ${k._count._all}`);
  }

  section("stock statuses present");
  const stock = await prisma.product.groupBy({ by: ["stockStatus"], _count: { _all: true } });
  for (const s of stock.sort((a, b) => a.stockStatus.localeCompare(b.stockStatus))) {
    console.log(`${s.stockStatus.padEnd(24)} ${s._count._all}`);
  }

  section("categories populated");
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
  for (const c of categories) {
    console.log(`${c.slug.padEnd(16)} order=${String(c.sortOrder).padEnd(4)} products=${c._count.products}`);
  }
  const empty = categories.filter((c) => c._count.products === 0);
  console.log(`empty categories: ${empty.length}`);

  section("shared prices (ties)");
  const ties = await prisma.product.groupBy({ by: ["price"], _count: { _all: true }, having: { price: { _count: { gt: 1 } } } });
  for (const t of ties.sort((a, b) => Number(a.price) - Number(b.price))) {
    const names = await prisma.product.findMany({ where: { price: t.price }, select: { slug: true, name: true }, orderBy: { name: "asc" } });
    console.log(`${String(t.price).padEnd(10)} ${names.map((n) => n.name).join(" | ")}`);
  }

  section("products carrying aliases");
  const withAliases = await prisma.product.findMany({
where: { aliases: { isEmpty: false } },
    select: { slug: true, name: true, aliases: true },
    orderBy: { slug: "asc" },
  });
  for (const p of withAliases) {
    console.log(`${p.slug.padEnd(18)} ${p.name.padEnd(22)} [${p.aliases.join(", ")}]`);
  }

  section("plural / singular asymmetry");
  for (const slug of ["carrot", "baby-carrots", "potato"]) {
    const p = await prisma.product.findUnique({ where: { slug }, select: { name: true, aliases: true } });
    if (p) {
      console.log(`${slug.padEnd(14)} name="${p.name}" aliases=[${p.aliases.join(", ")}]`);
    }
  }

  section("search: multi-token AND ('cherry tomato')");
  const tokens = ["cherry", "tomato"];
  const rows = await prisma.product.findMany({
    where: {
      AND: tokens.map((token) => ({
        OR: [
          { name: { contains: token, mode: "insensitive" } },
          { aliases: { has: token } },
        ],
      })),
    },
    select: { name: true, aliases: true },
    orderBy: { name: "asc" },
  });
  console.log(rows.map((r) => `${r.name} [${r.aliases.join(",")}]`).join("\n"));

  section("price ordering, ascending with name tiebreak");
  const ordered = await prisma.product.findMany({
    select: { name: true, price: true },
    orderBy: [{ price: "asc" }, { name: "asc" }],
    take: 6,
  });
  for (const p of ordered) {
    console.log(`${String(p.price).padEnd(10)} ${p.name}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error("coverage query failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });