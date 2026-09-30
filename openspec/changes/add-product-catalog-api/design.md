# Design

## Context

The repository contains no application source — only `openspec/`. The sibling
change `add-product-catalog` specifies a browse experience and authors its
product data as a static file inside the frontend, with a note that the array
shape "is the contract a real product API will be held to." This change builds
that API. See `proposal.md` for motivation and
`specs/product-catalog-api/spec.md` for requirements.

Constraints that shape the approach:

- **The consumer contract already exists.** 19 browse requirements pin the product
  shape, search semantics, sorting, and the three distinct empty states. The API
  does not get to choose these; it has to satisfy them. Where the browse spec was
  silent, the gap is called out in the decisions below.
- **Catalog size is bounded.** 20-40 products. Server-side filtering and sorting
  are instant, and the browse spec explicitly forbids pagination, so paging
  parameters would be dead weight.
- **No write path.** Cart and checkout do not exist, so stock is never mutated and
  there is no consistency problem to solve.
- **Greenfield.** No code, no manifest, no deployment. The workspace and the
  PostgreSQL instance are part of what this change stands up.

## Goals / Non-Goals

**Goals:**

- One place where catalog behavior is defined and tested once, server-side, so the
  frontend's static file can be deleted rather than maintained.
- A product shape that the frontend adopts by importing a type, so shape drift is
  a compile error instead of a runtime surprise.
- Validation and integrity enforced at the database boundary, so a hand-edited row
  cannot corrupt the catalog the way a hand-edited JSON file can today.
- Errors and empty states distinguishable by a client with no guesswork.

**Non-Goals:**

- Performance engineering for catalog scale, or an index strategy beyond what the
  data volume needs.
- Any mutation path, admin surface, or authentication — a seeded read-only catalog
  has nothing to authenticate.
- A generic repository base class, a dependency-injection container, or a plugin
  layer. The layer boundaries in decision 3 are real, but no framework extends or
  enforces them beyond the Prisma-confinement check described there.
- An authorization model, a rate limiter, or a caching layer. None is warranted by a
  34-product public catalog.

## Decisions

### 1. Standalone Express service, not Next.js API routes

**Decision:** `apps/api` is an Express + TypeScript service. The Next.js app
consumes it over HTTP.

Next.js API routes would avoid a second process and a CORS hop, and are the
default choice when a Next.js app needs endpoints. Rejected for three reasons:
route handlers live under `app/`, which conflates the storefront's render tree
with the catalog service's data model; the service and the storefront then cannot
scale, deploy, or fail independently; and the browse spec's own loader seam
anticipates a separate origin. The cost is real — a port, a CORS configuration, and
a dev proxy — and it is the cost that buys the separation.

### 2. Monorepo, a shared contract, and a database that becomes the source of truth

**Decision:** npm workspaces at the repository root: `apps/web`, `apps/api`,
`packages/product-contract`, and `packages/catalog-data`.

`packages/product-contract` holds the reusable API contract — the product and
category types, listing parameter shapes, and response envelopes. It is the single
declaration both apps depend on, and it is what makes shape drift a compile error:

```
              packages/product-contract
              { Product, Category, parameters, responses }
                    /                      \
                   v                        v
             apps/web                    apps/api
        depends on the contract      serves the contract

     rename a field  ->  both apps fail to compile
```

`packages/catalog-data` holds the authored seed dataset. Its role is to populate
the database at bootstrap, not to serve the storefront. The frontend reads it only
while it is not yet connected to the API; once its loader points at the API, that
dependency ends:

```
    now      apps/web --> catalog-data (fixture)     apps/api --> catalog-data (seed)
                                              |
                     frontend loader switches  |
                                              v
    later    apps/web --> product-contract  -->  GET /api/products  -->  PostgreSQL
                                                          catalog-data no longer read
```

The seed data is validated against `packages/product-contract`, so a row the API
would reject cannot be seeded, and the client's fixture type and the served
response type are the same declaration.

**Alternatives considered:** two repositories with the seed duplicated and a
published JSON Schema validating the frontend's copy in CI. That works, but it
moves enforcement from the compiler to a CI gate someone has to remember, it
splits ownership of one dataset across two histories, and it leaves the frontend
permanently coupled to a copy of production data — which is the arrangement this
change exists to end. Reconsidered and rejected.

**Accepted cost:** the frontend's build depends on a workspace package until it is
connected to the API, after which it depends only on the contract package. Seeding
remains a manual bootstrap step; rows added to the database afterwards are live
without touching the seed.

### 3. Feature-first modules with a retained service layer

**Decision:** `apps/api` is organized feature-first, with one module per domain
feature under `src/modules/`. Each module is a complete vertical slice — route,
controller, service, repository, schemas, types, mapper — and nothing about a
feature lives outside its own directory.

```
apps/api/src/
├── app.ts                 express assembly, middleware order
├── server.ts              listen, graceful shutdown
├── config/                env parsing and typed configuration
├── lib/                   framework-agnostic helpers
├── middleware/            validation, not-found, error handler
├── errors/                AppError and the error envelope
├── routes/                composes and mounts module routers
└── modules/
    ├── product/
    │   ├── product.route.ts
    │   ├── product.controller.ts
    │   ├── product.service.ts
    │   ├── product.repository.ts
    │   ├── product.schema.ts
    │   ├── product.types.ts
    │   └── product.mapper.ts
    └── category/
        ├── category.route.ts
        ├── category.controller.ts
        ├── category.service.ts
        ├── category.repository.ts
        ├── category.schema.ts
        └── category.types.ts
```

The dependency flow is one-directional:

```
  HTTP request
     │
     ▼
  route        path and method, applies validation middleware, delegates.
     │         No business logic, no database access.
     ▼
  controller   HTTP in, HTTP out. Reads already-validated params, query, and
     │         body; calls the service; shapes the HTTP response.
     │         Never touches Prisma.
     ▼
  service      Application logic. Applies defaults and catalog rules,
     │         coordinates one or more repositories, constructs the
     │         application-level result, throws application errors such as
     │         PRODUCT_NOT_FOUND. Never sees req or res.
     ▼
  repository   Prisma and SQL only. Queries, filtering, sorting, aggregates.
     │         No HTTP concepts; never receives req or res.
     ▼
  Prisma ──► PostgreSQL
```

**Why the service layer is retained when the catalog is this small.** The standard
argument for omitting it is that a single endpoint performing a query translation
and a row mapping does not justify a layer. That argument is correct about *this
catalog* and wrong about *this codebase*.

This API is the foundation of a system that will carry inventory, cart, orders,
pricing, and authentication. Each of those is a business workflow rather than a
lookup, and they compose: reserving stock touches inventory and cart, pricing
touches the product catalog and promotions, authentication touches every write
path. The compositions are the reason the layer exists. When a second entry point
needs the same rule — a job reconciling stock, a scheduled pricing refresh, an
administrative tool — the service is already the shared place for it, holding no
HTTP or database concepts that entry point would have to work around.

The cost is real and visible today: most service functions are thin, and a reader
may reasonably wonder what the layer is for. What it buys is that the first
genuinely complex rule lands in a layer that already exists and already has tests,
rather than arriving as business logic inside a controller and spreading outward
from there.

**Constraints the architecture imposes:**

- Prisma is imported only from repository modules and `prisma/` infrastructure. No
  route, controller, or service imports the Prisma client. This is enforced by a
  lint rule or an architectural test, not by convention.
- Services receive plain arguments and return plain values. They never receive
  `req` or `res`, which is exactly what keeps them callable from a non-HTTP entry
  point later.
- Request and response schemas and types live in the feature that uses them, not
  in a shared bucket, so a product schema change is a change inside the product
  module.
- `src/routes/` composes and mounts module routers; it defines no endpoints itself.

**Alternatives considered:** organizing by layer rather than feature — `routes/`,
`controllers/`, `services/`, `repositories/` each spanning all features — which
spreads one feature's behavior across four directories and makes adding a feature
a four-directory change; a generic repository base class or DI container, which
adds indirection without encapsulating any policy; and omitting the service and
promoting business logic into controllers, which is the arrangement that has to be
unwound later, when unwinding it is expensive.

**Accepted cost:** the service layer reads as ceremony until the first workflow
that needs it. The mitigation is that it stays thin — a service that starts
performing HTTP or SQL is violating the boundary and should be corrected rather than
extended.

### 4. Schema constraints as the integrity boundary

**Decision:** Uniqueness, required fields, and value domains live in the database.
Application validation is a convenience; the constraint is the guarantee.

This inverts the frontend's arrangement, where the seed file is validated by a test.
There, a bad row is a failed test. Here, `UNIQUE (slug)` and `CHECK (price > 0)`
make a bad row unwriteable regardless of which client wrote it — and the next client
will not remember to call the validator.

| Invariant | Enforcement |
|---|---|
| slug unique | `UNIQUE` |
| price > 0 | `CHECK (price > 0)` |
| name, slug, price, categoryId, stockStatus, selling unit present | `NOT NULL` |
| product belongs to an existing category | foreign key, `ON DELETE RESTRICT` |
| selling unit kind, stock status | `varchar` + `CHECK` |

`sellingUnitKind` and `stockStatus` are `varchar` with a check rather than a native
enum type. Both are closed sets, but adding a value to a PostgreSQL enum means
`ALTER TYPE ... ADD VALUE`, which historically cannot run inside a transaction —
awkward enough in a migration that a `CHECK` constraint is the cheaper way to stay
flexible.

### 5. Money as `numeric(12,2)` with an explicit decimal-to-number conversion

**Decision:** Prices are stored as `numeric(12,2)` and converted to a JavaScript
number in the response mapper.

`numeric` is exact and orders correctly, which matters because price is a sort key.
Floating point would make `ORDER BY` on price subtly wrong and rounding a
recurring bug.

The conversion is mandatory rather than incidental. Prisma returns a `Decimal`
object, and an unmapped response serializes it as an internal representation rather
than a number:

```
  prisma Decimal            ->  { "s": 1, "e": 2, "d": [12000] }
  mapper Number(toFixed(2)) ->  120
```

Nothing in the type system catches a forgotten mapper, so this conversion is
covered by a contract test asserting a returned price is a number.

**No currency column.** The currency is fixed site-wide. A column with a single
value invites the multi-currency work that is explicitly out of scope, and the API
deliberately returns a bare amount so the client owns the symbol and the decimal
formatting.

### 6. Search as one concatenated containment predicate

**Decision:** Match with a single SQL predicate over the product's name and aliases,
combined with AND across tokens.

```sql
WHERE (p.name || ' ' || array_to_string(p.aliases, ' '))
      ILIKE ALL (ARRAY['%cherry%', '%tomato%'])
```

`ILIKE` gives case-insensitivity without lowering the column, and `ALL` over an
array expresses "every token must match" without nesting a subquery per token.
Concatenating first means one predicate instead of one per token.

The one-directional asymmetry the browse spec requires falls out of `ILIKE` for
free, because containment is exactly the specified rule:

```
  q "carrot"   vs  "Carrots"    "carrots" ILIKE '%carrot%'  ->  match
  q "carrots"  vs  "Carrot"     "carrot"  ILIKE '%carrots%' ->  no match
```

No stemming is applied to either side, so plural forms must be carried as aliases.
That is an authoring obligation the spec already states, not a gap this layer can
close.

`text[]` is used for aliases and images rather than a join table: two or three
values per product does not earn a relational table, and keeping them as arrays is
what allows the single predicate above.

**Alternatives considered:** a tsvector column (silently enables prefix matching —
`carro` would hit `Carrot` — which no requirement asks for and no test would cover);
fuzzy matching (unpredictable near-misses like `parsnip` → `pea` at this scale).

**Accepted cost:** `%token%` cannot use a btree index, so search is a sequential
scan. At 34 rows that is free. If the catalog reaches tens of thousands of rows,
`pg_trgm` with a GIN index is the standard remedy and the predicate does not have to
change.

### 7. Facet counts computed on the search-filtered set, in the listing response

**Decision:** `GET /api/products` returns the products plus the category options and
their counts in one response, so the client makes one request per browse state.

Counts reflect the active search but ignore the request's own category restriction,
per the browse spec. That makes a count honest about what clicking it will yield:
with `q=carrot`, a count of 0 on Leafy tells the truth rather than advertising
products the query will not return.

Because filtering is single-select, ignoring the current category has no
self-referential ambiguity — the "counts shrink as you select" problem only exists
with multi-select.

Counts come from a grouped aggregate over the search-filtered set rather than from
client-side counting. The client already holds every row, so it could count them, but
doing it server-side keeps one definition of "what this selection yields" instead of
two implementations that can disagree.

Assembling the listing response is therefore a coordination across two repositories —
products, and the category facets — which is service work. `ProductService` calls
`ProductRepository` for the rows and the matched count and `CategoryRepository` for
the facet aggregate, then composes the application-level result. Neither repository
knows the response shape, and the controller does not know either aggregate exists.

**Consequence of omitting zero-count categories.** The browse spec says a category
with no products is not offered, but is silent on a category whose count is zero
*because of the active search*. Omitting it satisfies the spec as written and is what
this API does. The edge case: with `category=roots&q=dragonfruit`, `roots` itself is
omitted while still being applied, so the client shows `All` as the only option
beside an empty result. Legible only because the empty state says no vegetables
matched. Documented in the spec; a client wanting the selected category always
visible would need a spec change.

**`sortOrder` is a real column, not alphabetical ordering.** The browse spec never
states an order, so merchandising order is explicit data rather than an accident of
insertion order or collation.

### 8. Strict API, lenient client

**Decision:** The API rejects an unrecognized `sort` or an unknown `category` with a
`400` naming the parameter. It never silently substitutes a default.

The browse spec requires lenient handling of unrecognized URL values, which sounds
like a contradiction but is not — the two layers receive different inputs:

```
  URL  /vegetables?category=bogus

    client parses URLs     unknown category -> fall back to "All"   (lenient)
                            stale shared links and hand-edited URLs
                            are normal input for a URL

    client builds request  sends category=all; the bogus value never
                            reaches the API

    API validates requests rejects anything unrecognized           (strict)
                            a client that skipped the first layer
                            has a bug, and should be told
```

The alternative — inheriting the leniency and returning every product for an unknown
category — produces a response that is indistinguishable from success and hides the
bug permanently. Rejecting costs one round trip to confirm a category exists, which
is a fair price for catching a caller error.

### 9. Two counters, so three empty states are distinguishable

**Decision:** The listing response reports `matched` (products after filtering) and
`catalogTotal` (products in the catalog regardless of filter).

The browse spec requires three distinguishable states: catalog empty, filters
matched nothing, and data unavailable. A naive API collapses the first two into
`{ data: [] }`:

```
  GET /api/products        (0 rows in catalog)  ->  { data: [] }
  GET /api/products?q=zzz  (34 rows in catalog) ->  { data: [] }

  the client cannot tell an empty catalog from a query that matched nothing
```

Both counters separate them with no extra request:

```
  data: []  catalogTotal: 0    ->  catalog unavailable
  data: []  catalogTotal: 34   ->  no vegetables matched
  5xx or transport failure     ->  data unavailable
```

`matched` is also the result count the browse spec requires the client to display, so
both fields are already needed; the empty-state distinction costs nothing extra. It
is also the field a future cursor or limit would need, so the eventual move to
pagination is paved by a requirement that exists today rather than by parameters no
caller uses.

### 10. Validation in three layers, including the response

**Decision:** Validate the request at the boundary, validate the response on the way
out, and constrain the database.

```
  request   zod schema per endpoint, held in the feature's own schema file;
            failure -> 400 naming the field
  response  zod parse of the DTO before serialization, same feature
  database  NOT NULL / UNIQUE / CHECK / FK   (decision 4)
```

The response layer is the one that gets skipped, and it is the one that earns its
keep. It converts "the API shipped an unusable price" from a production incident
into a failing test, catching a forgotten decimal conversion (decision 5), a dropped
optional field, and any mapper regression. It is a few lines against the entire
class of silent serialization bugs.

Because the schemas are feature-local, validation travels with the behavior it
guards: the product module's rules are found in the product module, and a rule
retired with its feature leaves nothing behind to clean up elsewhere.

### 11. One error envelope, opaque failures

**Decision:** Every failure returns `{ error: { code, message, field? } }`. The
`field` key is present only when the failure is attributable to a named parameter.

Ownership is split by decision 3: a service raises application errors as the
`AppError` type held in `src/errors/`, and the error-handling middleware translates
any error — `AppError` or not — into the envelope and the status code. The service
never constructs an HTTP response and never chooses a status code beyond what the
error type carries.

```
  400  INVALID_QUERY       a query parameter failed validation
  404  PRODUCT_NOT_FOUND   no product has that slug
  404  ROUTE_NOT_FOUND     no route matches the path
  500  INTERNAL            anything unhandled

  not errors:
    empty result set  ->  200 with an empty product set
    empty catalog     ->  200 with catalogTotal 0
```

An empty result is a success with no rows, because a client branching on error status
would otherwise be forced to treat "no match" as a failure. The `500` body carries
only a generic code: the browse spec maps `5xx` to its data-unavailable state, so a
leaky `500` is both a UX defect and an information disclosure of schema and query
internals.

Express needs `errorHandler` registered last with all four parameters, and `notFound`
registered before it, or an unmatched path returns a `500` containing a stack trace.

### 12. Read-only: no auth, no mutations

**Decision:** The API exposes `GET` only. No authentication, no write endpoints.

A seeded catalog of 34 public vegetables has nothing to authenticate, and adding
auth now would gate a public storefront for no benefit. The absence is the cheap,
reversible direction: adding it later protects new endpoints without disturbing
existing ones, whereas removing it later breaks clients.

This is a decision rather than a limitation. It is also what makes stock decorative
permanently — see risks.

### 13. `docker-compose.yml` for PostgreSQL, and CORS for the dev origin

**Decision:** A compose file providing PostgreSQL for local development, and CORS
configured for the frontend's development origin.

The stack requires a real database, so a way to run one locally is part of standing
this up rather than an optional convenience. CORS is likewise not optional: the
Next.js dev server and the API are different origins, and without it every request
fails in development.

### 14. Published contract derived from the same schemas

**Decision:** Generate an OpenAPI document from the zod schemas that already validate
requests, and publish it as a repository artifact.

The schemas are the single source of truth either way, so generating the document
costs no additional declaration. Hand-written documentation would drift from the code
silently and offer a client nothing to generate from.

## Risks / Trade-offs

- **The client contract has zero implementations behind it.** Everything here is
  derived from `add-product-catalog`, which passes validation but has 0 of 33 tasks
  implemented. If frontend implementation reveals the contract was wrong, this API
  inherits the fix → Treat the two changes as a pair rather than independent work, and
  resolve the open questions below before building either.
- **Search quality is bounded by alias coverage.** A product with no aliases is
  unfindable by any name but its own, and `carrots` will not find `Carrot` → Treat
  aliases as required seed content, not optional polish, and cover them in tests.
- **Sequential scan for search.** `%token%` cannot use a btree index → Free at this
  scale; `pg_trgm` with a GIN index is the standard remedy if the catalog grows, and
  the predicate stays the same.
- **Stock status stays decorative.** `low_stock` is a merchandising label with no
  inventory behind it, and no write path exists to make it truthful → Accepted; it
  becomes meaningful when a real inventory source replaces the seed. A quantity
  column was considered and deferred: it would require a per-product low-stock
  threshold that no requirement defines.
- **The service layer is thin enough to look like ceremony** (decision 3). A reader
  may reasonably question what a mostly-forwarding layer buys in a three-endpoint
  catalog → Accepted deliberately: its value is realized by the inventory, cart,
  order, and pricing workflows this API is built to carry, and keeping repository
  and HTTP concerns out of it now means those workflows compose rather than
  requiring an unwinding. It stays thin; a service performing HTTP or SQL is a
  boundary violation to correct, not a pattern to extend.
- **The layer boundaries can erode.** Four layers with thin implementations invite
  shortcuts — a controller querying Prisma, a repository returning HTTP shapes →
  Mitigated by the architectural check in the tasks, which fails the build when
  Prisma is imported outside repository modules and infrastructure.
- **A monorepo couples two deployments.** A change to the contract package affects
  both apps → Accepted: the alternative is silent drift between a served shape and a
  consumed one.
- **The frontend keeps a transitional dependency on seed data** (decision 2) → It
  ends when the frontend's loader switches to the API, which is the change
  `add-product-catalog` already anticipated with its loader seam.
- **Selected category omitted from its own options at zero count** (decision 7) → The
  empty state makes it legible; revisiting it is a spec change, not a code change.
- **`RESTRICT` on category deletion** means a populated category cannot be deleted
  until its products move or go → No write path exists today, so this is a
  migration-time decision rather than an immediate constraint.

## Migration Plan

Nothing to migrate: no application code or archived specs exist. The sequence is
compose up, migrate, seed, serve.

Rollback is deleting the change. The seed is idempotent (decision 4 and the seed
requirement), so re-running it after a data fix converges rather than duplicating.

## Open Questions

- **Workspace tooling.** npm workspaces is assumed here. pnpm would improve
  install times and enforce the dependency boundary between packages; bun is faster
  still. This affects lockfile and CI only — no spec, no requirement, and no task
  depends on the choice, so it can be settled while scaffolding.
- **Route versioning.** Routes are unversioned (`/api/products`). Prefixing with
  `/v1` later is a breaking path change for a client that has already shipped,
  whereas adding it now is cheap. Deferred because there is exactly one consumer and
  no second version to distinguish.
- **Seed content.** The specific 20-40 vegetables, categories, prices, and image
  references are authoring decisions that do not affect the specs or the approach.
  Image URLs reference externally hosted assets; no image storage or upload is in
  scope.