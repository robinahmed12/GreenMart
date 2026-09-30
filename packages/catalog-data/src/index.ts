export { categories, product, products } from "./products.js";
export type { SeedCategory, SeedProduct } from "./products.js";
export {
  CatalogIntegrityError,
  assertCatalogIntegrity,
  findCatalogIssues,
} from "./validate.js";
export type { CatalogIssue } from "./validate.js";