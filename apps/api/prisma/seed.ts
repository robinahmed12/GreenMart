import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(repoRoot, ".env") });

const { PrismaClient } = await import("@prisma/client");
const { assertCatalogIntegrity, categories, products } = await import("@catalog/catalog-data");

type PrismaClientType = InstanceType<typeof PrismaClient>;

const prisma: PrismaClientType = new PrismaClient();

async function main(): Promise<void> {
  assertCatalogIntegrity(categories, products);

  const categorySlugToId = new Map<string, string>();

  for (const category of categories) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder },
      create: { slug: category.slug, name: category.name, sortOrder: category.sortOrder },
      select: { id: true },
    });
    categorySlugToId.set(category.slug, row.id);
  }

  let created = 0;
  let updated = 0;

  for (const product of products) {
    const categoryId = categorySlugToId.get(product.categorySlug);
    if (categoryId === undefined) {
      throw new Error(`seed product "${product.slug}" names unknown category "${product.categorySlug}"`);
    }

    const data = {
      name: product.name,
      aliases: [...product.aliases],
      description: product.description,
      price: product.price,
      sellingLabel: product.sellingUnit.label,
      sellingKind: product.sellingUnit.kind,
      stockStatus: product.stockStatus,
      imageUrl: product.imageUrl ?? null,
      images: [...(product.images ?? [])],
      origin: product.origin ?? null,
      storage: product.storage ?? null,
      preparation: product.preparation ?? null,
      nutrition: product.nutrition ?? null,
      allergens: [...(product.allergens ?? [])],
      categoryId,
    };

    const existing = await prisma.product.findUnique({ where: { slug: product.slug }, select: { id: true } });

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: data,
      create: { slug: product.slug, ...data },
    });

    if (existing === null) {
      created += 1;
    } else {
      updated += 1;
    }
  }

  console.log(`seed complete: ${categories.length} categories (${categorySlugToId.size} upserted), ${products.length} products (${created} created, ${updated} updated)`);
}

main()
  .catch((error: unknown) => {
    console.error("seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });