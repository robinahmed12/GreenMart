# Proposal

## Why

The browse experience for the vegetable catalog is specified in `add-product-catalog`
but has no data source to read from — the repository contains no application
source at all, so product data is authored as a static file inside the frontend.
That fixture is a stand-in, and it stops being viable the moment a product is
added, a price changes, or two people edit data independently.

This change introduces the real thing: a read-only HTTP service over PostgreSQL
that serves the catalog. Building it now, rather than when the cart arrives,
keeps the product model and the API contract in one place instead of splitting
them across a fixture and a service.

## What Changes

- **Add `apps/api`** — an Express + TypeScript service with Prisma over
  PostgreSQL, separate from the Next.js frontend. Next.js API routes are not
  used as the backend.
- **Add a feature-first modular architecture** — the API is organized as one
  module per domain feature under `apps/api/src/modules`, each a complete
  vertical slice, with a strict dependency flow:
  `Route → Controller → Service → Repository → Prisma → PostgreSQL`. Prisma is
  reachable only from repository modules.
- **Add a product and category data model** — one sellable SKU per product,
  authored unique slugs, flat data-driven categories with an explicit display
  order, and three informational stock states.
- **Add product aliases** — a list of alternative names per product, including
  regional, British/American, and plural forms that containment alone cannot
  match.
- **Add read-only catalog endpoints** — `GET /api/products` with `q`, `category`,
  and `sort` parameters, `GET /api/products/:slug`, and `GET /api/categories`.
- **Add search, category filtering, and price sorting** — case-insensitive
  whitespace-tokenized search over name plus aliases with AND semantics and no
  stemming; single-select category filtering; price-ascending default with a name
  tiebreak. Sorting compares total sellable-SKU price, never a normalized unit
  price.
- **Add seed data and a shared contract** — 20-40 products and their categories
  loaded idempotently to bootstrap the database, plus a reusable contract package
  holding the product types and response shapes that both apps depend on, so the
  served shape and the client's shape cannot drift apart.
- **Add request validation and a consistent error envelope** — validation on
  every query parameter with field-level errors, one error response shape, and a
  real `404` for an unknown slug.
- **Add tests** for the catalog API at three levels — repository, service, and
  HTTP integration — covering search semantics, filtering, sort determinism, error
  responses, and the response contract.

## Capabilities

### New Capabilities
- `product-catalog-api`: Serves the read-only vegetable catalog over HTTP —
  product and category data models, the catalog listing with search, category
  filtering and price sorting, the single-product lookup by slug, category
  listing, and the validation, error, and data-validity rules that make those
  responses trustworthy to a client.

### Modified Capabilities

None. `product-catalog` is specified in the in-flight `add-product-catalog`
change and is not modified here; this change provides the data source it consumes
without altering any of its requirements.

## Impact

- **New code** — `apps/api` organized feature-first:
  - `src/app.ts` and `src/server.ts` (application assembly, listen, shutdown)
  - `src/routes/` composing and mounting module routers
  - `src/modules/product/` and `src/modules/category/`, each holding a route,
    controller, service, repository, and feature-local schemas, types, and
    mapper
  - `src/middleware/` (request validation, not-found, error handling)
  - `src/errors/` (the application error type and error envelope)
  - `src/config/` (typed environment), `src/lib/` (helpers)
  - `prisma/` (schema, migrations, seed script) as the only database
    infrastructure
- **New shared packages** — `packages/product-contract` holding the reusable API
  types and response shapes both apps depend on, and `packages/catalog-data`
  holding the authored seed dataset used to bootstrap the database.
- **New dependencies** — `express`, `prisma`, `@prisma/client`, `zod`, and the
  OpenAPI generation tooling derived from those zod schemas.
- **New infrastructure** — a PostgreSQL database with a schema migration and a
  seed script. No write path, so no admin surface and no authentication.
- **Frontend relationship** — `apps/web` reads from the seed package only while
  it is not yet connected to the API, and switches its single loader to the API
  without changing the product shape, because both sides depend on the same
  contract types. The database becomes the long-term source of product data; the
  frontend does not permanently depend on the seed dataset.
- **Not affected** — no existing behavior or spec changes, because no application
  code and no archived specs exist yet.