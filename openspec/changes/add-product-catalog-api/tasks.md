# Tasks

## 1. Workspace and Local Database

- [x] 1.1 Initialize npm workspaces at the repository root with `apps/web`, `apps/api`, `packages/product-contract`, and `packages/catalog-data`, add a shared `tsconfig.base.json`, and verify a clean install succeeds with all workspace packages resolved
- [x] 1.2 Add a `docker-compose.yml` providing PostgreSQL with a persistent volume and a `.env` carrying the connection string, and verify the database container starts and accepts a connection
- [x] 1.3 Scaffold `apps/api` as a TypeScript Express application with a test runner and the feature-first directory layout — `src/app.ts`, `src/server.ts`, `src/config`, `src/lib`, `src/middleware`, `src/errors`, `src/routes`, `src/modules` — and verify it boots, serves a placeholder route, and that its test command runs

## 2. Shared Contract and Seed Packages

- [x] 2.1 Create `packages/product-contract` exporting the reusable `Product`, `Category`, `SellingUnit`, `StockStatus`, catalog listing parameter, and response types, and verify both `apps/web` and `apps/api` resolve it as a workspace dependency
- [x] 2.2 Encode the single-sellable-SKU and positive-price rules in the contract types so a product carrying two selling units or a non-positive price is rejected at compile time, and verify a type-level test asserts both rejections
- [x] 2.3 Create `packages/catalog-data` holding the authored seed dataset and its integrity validation, and verify the dataset type-checks against the contract in 2.1 and that the validation test fails when a deliberately invalid fixture is passed
- [x] 2.4 Author the category data as a flat list each carrying a slug, display name, and explicit `sortOrder`, and verify the ordering is unambiguous and non-overlapping
- [x] 2.5 Author 20-40 products covering every selling unit kind and every stock status including at least one out-of-stock, with at least two products sharing a price, at least one product carrying aliases, and at least one carrying the plural form of a singular name; verify a test asserts each of these coverage conditions

## 3. Database Schema and Migration

- [x] 3.1 Define the `Category` and `Product` models in the Prisma schema with a unique slug, a `numeric(12,2)` price, `text[]` aliases and images, `varchar` selling unit kind and stock status, and a foreign key to `Category` with `ON DELETE RESTRICT`, and verify the schema validates
- [x] 3.2 Generate and apply the initial migration, and verify `NOT NULL`, `UNIQUE`, `CHECK (price > 0)`, and the supported-value checks all exist in the applied migration
- [x] 3.3 Prove each integrity invariant at the database level by attempting a duplicate slug, a zero and a negative price, a missing category reference, an unsupported stock status, and an unsupported selling unit kind, and verify every attempt is rejected by the database

## 4. Seed Loading

- [x] 4.1 Implement a seed script that reads categories and products from `packages/catalog-data` and inserts them, and verify the seeded row counts match the authored data
- [x] 4.2 Make the seed idempotent by keying writes on slug so a second run converges, and verify running the seed twice leaves exactly one row per slug and category and exits successfully
- [x] 4.3 Verify the seeded data satisfies the coverage the specs require for search, sorting, and stock by querying the seeded database for each selling unit kind, stock status, shared-price pair, and alias case

## 5. Shared Application Infrastructure

- [x] 5.1 Create `src/errors` with the `AppError` type and the error envelope factory, carrying a status, a code, a message, and an optional parameter name, and verify a unit test asserts the envelope shape for a parameterized and a non-parameterized failure
- [x] 5.2 Create `src/middleware` with the not-found and error-handling middleware, registering the error handler after all routes and with all four Express parameters, and verify an unmatched path returns a 404 envelope while a thrown `AppError` returns its own status and code and an unhandled error returns a 500 envelope containing no stack trace, database message, or query
- [x] 5.3 Create the zod-based request validation middleware returning a 400 envelope naming the offending parameter, and verify a unit test asserts the named field for a bad query parameter
- [x] 5.4 Create `src/lib` helpers and `src/routes/index.ts` that composes and mounts module routers, and verify a module router mounted through it is reachable at its expected path
- [x] 5.5 Enforce that Prisma is imported only from repository modules and `prisma/` infrastructure by adding a lint rule or architectural test, and verify the check fails when a service or controller imports the Prisma client

## 6. Product Module

- [x] 6.1 Create `modules/product/product.types.ts` and `product.schema.ts` with the product, listing parameter, and response schemas, deriving the product shape from the shared contract, and verify a schema test rejects a product missing a required detail field
- [x] 6.2 Create `product.mapper.ts` converting a database row to a response object including the decimal price to number conversion, and verify a contract test asserts a mapped price is a JSON number equal to the seeded price
- [x] 6.3 Implement `product.repository.ts` queries returning rows with their category, unfiltered and category-filtered, and verify a repository test asserts the row count for each filter and that out-of-stock products are included
- [x] 6.4 Implement the repository search predicate as a single case-insensitive containment match over the product's name and aliases combined with AND across all query tokens, and verify repository tests cover case-insensitivity, multi-token AND, the shorter-token and longer-token asymmetry, alias resolution, and the plural-form-via-alias case
- [x] 6.5 Implement repository price sorting in both directions with a product-name tiebreak, and verify a repository test asserts ascending and descending order and that equal-price products are returned in name order regardless of insertion order
- [x] 6.6 Implement the repository lookup by slug and the aggregate total product count, and verify a repository test asserts a known slug is found and an unknown slug yields no row
- [x] 6.7 Verify `product.repository.ts` is the only file in the module importing Prisma, and verify the architectural check from 5.5 passes for the product module

## 7. Category Module

- [x] 7.1 Create `modules/category/category.types.ts` and `category.schema.ts` with the category and facet response types, and verify a schema test accepts a category carrying slug, name, and display order and rejects one missing them
- [x] 7.2 Implement `category.repository.ts` with the grouped aggregate returning every category holding at least one product, in ascending display order, each with its unfiltered product count, and verify a repository test asserts ordering, the omission of an empty category, and the counts
- [x] 7.3 Implement the repository facet aggregate returning each category's count over the search-filtered set while ignoring the requested category restriction, and verify a repository test asserts counts narrow with the search query and that the requested category's count equals the filtered row count
- [x] 7.4 Implement the repository lookup of a single category by slug, and verify a repository test asserts a known slug resolves and an unknown slug yields nothing

## 8. Product Service

- [x] 8.1 Implement `product.service.ts` with the catalog listing operation applying defaults for absent parameters and coordinating `product.repository` and `category.repository` to compose the products, `matched`, `catalogTotal`, and category facet options, and verify a service test with stubbed repositories asserts the composed result and that defaults are applied when no parameters are supplied
- [x] 8.2 Verify the service applies AND semantics between the search query and the requested category and passes the sort direction through to the repositories, and verify a service test asserts the repository arguments for a combined search-and-category request
- [x] 8.3 Verify the service omits categories whose facet count is zero from the returned options, including when the requested category's own count is zero, and verify a service test asserts the omission
- [x] 8.4 Implement the service's product-by-slug operation translating an absent repository result into the `PRODUCT_NOT_FOUND` application error, and verify a service test asserts the raised error's code and that a found product is returned unchanged
- [x] 8.5 Verify the service composes the empty-state result distinguishing an empty catalog from a filter that matched nothing through `catalogTotal`, and verify a service test asserts both cases from stubbed repository results
- [x] 8.6 Verify `product.service.ts` neither receives Express request or response objects nor imports Prisma, and verify the architectural check from 5.5 passes

## 9. Category Service

- [x] 9.1 Implement `category.service.ts` with the category listing operation delegating to `category.repository` and returning populated categories in display order with unfiltered counts, and verify a service test asserts the returned options
- [x] 9.2 Implement the service's category resolution for a requested slug, raising the unknown-category application error naming the `category` parameter when the slug resolves to nothing, and verify a service test asserts the raised error's code and named parameter
- [x] 9.3 Verify `category.service.ts` neither receives Express request or response objects nor imports Prisma, and verify the architectural check from 5.5 passes

## 10. Controllers and Routes

- [x] 10.1 Implement `product.route.ts` and `product.controller.ts` so the route declares the method and path and applies validation middleware while delegating to the service, and verify an HTTP integration test asserts the full catalog is returned unpaginated with both counters when no parameters are supplied
- [x] 10.2 Verify search, category filtering, and sorting apply end to end through controller and service with AND semantics, and verify HTTP integration tests cover search within a category, unfiltered categories, and sorting applied to the filtered set only
- [x] 10.3 Verify `q`, `category`, and `sort` are rejected with a 400 naming the parameter for an unrecognized sort value, an unknown category, and an overlong query, and verify an HTTP integration test asserts each rejection and that no default is silently substituted
- [x] 10.4 Verify the empty-state contract over HTTP: an empty catalog returns a success with `catalogTotal` zero, a query matching nothing returns a success with a non-zero `catalogTotal`, and the two are distinguishable without an extra request
- [x] 10.5 Verify a zero-count category is omitted from the reported options over HTTP, including when the requested category's own count is zero
- [x] 10.6 Implement `product.route.ts`'s slug route, and verify an HTTP integration test asserts a known slug returns every required field and that an out-of-stock product is served in full with its stock status
- [x] 10.7 Verify an unknown slug returns a 404 with the not-found error envelope, no redirect, and no success status
- [x] 10.8 Implement `category.route.ts` and `category.controller.ts`, and verify an HTTP integration test asserts the ordering, the omission of an empty category, and the counts
- [x] 10.9 Verify neither module's controller imports Prisma and neither route carries business logic, and verify the architectural check from 5.5 passes for both modules
- [x] 10.10 Verify the API exposes no write route: requests using non-read methods on any path are rejected, no product or stock row is modified, and stock statuses are unchanged after serving the full read surface

## 11. Contract and Developer Experience

- [x] 11.1 Configure CORS for the frontend's development origin and add a health endpoint, and verify a request carrying that origin succeeds while the health endpoint reports the database is reachable
- [x] 11.2 Generate an OpenAPI document from the feature-local request and response schemas, commit it, and verify the generated document covers all three endpoints, their parameters, and the error envelope
- [x] 11.3 Add environment validation in `src/config` that fails at startup when required variables are missing, and verify the service refuses to boot with an incomplete environment
- [x] 11.4 Add an API reference documenting each endpoint's parameters, response shape, the error codes, and the two-counter empty-state contract, and verify every documented parameter and error code matches the OpenAPI document

## 12. Final Verification

- [x] 12.1 Run the full typecheck, test suite, and linter across all workspace packages, and verify all pass with no skipped tests
- [x] 12.2 Verify the seeded service end to end from a clean database: compose up, migrate, seed twice, then serve each endpoint, confirming the spec's coverage conditions are observable in live responses
- [x] 12.3 Verify a product inserted directly into the database is served over HTTP even though the seed dataset does not contain it, confirming the database rather than the seed is the source of truth
- [x] 12.4 Run `openspec validate add-product-catalog-api --strict` and confirm the change validates with no errors