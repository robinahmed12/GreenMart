import type { SeedCategory, SeedProduct } from "./products.js";

export interface CatalogIssue {
  readonly path: string;
  readonly message: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }
  return [...repeated];
}

export function findCatalogIssues(
  categories: readonly SeedCategory[],
  products: readonly SeedProduct[],
): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const report = (path: string, message: string): void => {
    issues.push({ path, message });
  };

  const categorySlugs = new Set<string>();
  const categorySortOrders = new Map<number, string>();

  categories.forEach((category, index) => {
    const path = `categories[${index}]`;

    if (isBlank(category.slug)) {
      report(`${path}.slug`, "category slug must not be blank");
    } else if (!SLUG_PATTERN.test(category.slug)) {
      report(`${path}.slug`, `category slug "${category.slug}" must be lower-case and hyphenated`);
    }

    if (categorySlugs.has(category.slug)) {
      report(`${path}.slug`, `duplicate category slug "${category.slug}"`);
    }
    categorySlugs.add(category.slug);

    if (isBlank(category.name)) {
      report(`${path}.name`, "category name must not be blank");
    }

    if (!Number.isInteger(category.sortOrder) || category.sortOrder <= 0) {
      report(`${path}.sortOrder`, `sortOrder must be a positive integer, received ${category.sortOrder}`);
    }

    const owner = categorySortOrders.get(category.sortOrder);
    if (owner !== undefined) {
      report(`${path}.sortOrder`, `sortOrder ${category.sortOrder} is already used by "${owner}", so display order is ambiguous`);
    }
    categorySortOrders.set(category.sortOrder, category.slug);
  });

  const productSlugs = new Set<string>();

  products.forEach((product, index) => {
    const path = `products[${index}] (${product.slug})`;

    if (isBlank(product.slug)) {
      report(`${path}.slug`, "product slug must not be blank");
    } else if (!SLUG_PATTERN.test(product.slug)) {
      report(`${path}.slug`, `product slug "${product.slug}" must be lower-case and hyphenated`);
    }

    if (productSlugs.has(product.slug)) {
      report(`${path}.slug`, `duplicate product slug "${product.slug}"`);
    }
    productSlugs.add(product.slug);

    if (isBlank(product.name)) {
      report(`${path}.name`, "product name must not be blank");
    }

    if (isBlank(product.description)) {
      report(`${path}.description`, "product description must not be blank");
    }

    if (!(product.price > 0)) {
      report(`${path}.price`, `price must be greater than zero, received ${product.price}`);
    }

    if (!categorySlugs.has(product.categorySlug)) {
      report(`${path}.categorySlug`, `category "${product.categorySlug}" is not in the category list`);
    }

    if (isBlank(product.sellingUnit.label)) {
      report(`${path}.sellingUnit.label`, "selling unit label must not be blank");
    }

    for (const alias of duplicates(product.aliases)) {
      report(`${path}.aliases`, `alias "${alias}" is repeated`);
    }

    for (const alias of product.aliases) {
      if (isBlank(alias)) {
        report(`${path}.aliases`, "alias must not be blank");
      } else if (alias.trim().toLowerCase() === product.name.trim().toLowerCase()) {
        report(`${path}.aliases`, `alias "${alias}" repeats the product name and adds no search value`);
      }
    }

    for (const image of product.images ?? []) {
      if (isBlank(image)) {
        report(`${path}.images`, "image URL must not be blank");
      }
    }
  });

  return issues;
}

export class CatalogIntegrityError extends Error {
  readonly issues: readonly CatalogIssue[];

  constructor(issues: readonly CatalogIssue[]) {
    super(`catalog integrity check failed with ${issues.length} issue(s)`);
    this.name = "CatalogIntegrityError";
    this.issues = issues;
  }
}

export function assertCatalogIntegrity(
  categories: readonly SeedCategory[],
  products: readonly SeedProduct[],
): void {
  const issues = findCatalogIssues(categories, products);
  if (issues.length > 0) {
    throw new CatalogIntegrityError(issues);
  }
}