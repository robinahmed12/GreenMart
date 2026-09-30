# Tasks

## 1. Application Scaffold

- [ ] 1.1 Initialize the application per design decision 1 (Next.js App Router + TypeScript) and verify the dev server starts and renders the default route
- [ ] 1.2 Configure the test runner, type checking, and linting, and verify a trivial test and a clean typecheck both pass
- [ ] 1.3 Add placeholder routes at `/vegetables` and `/vegetables/[slug]`, and verify each path responds
- [ ] 1.4 Write a README covering install, run, test, lint, and typecheck commands, and verify every command in it runs as written

## 2. Product Model and Catalog Data

- [ ] 2.1 Define the product type: id, slug, name, aliases, description, image,
  price, `sellingUnit { label, kind }`, categoryId, stock, and the detail-only
  fields (origin, storage, preparation, nutrition, allergens, secondary images).
  Constrain `stock` to the three states and `sellingUnit.kind` to the four kinds,
  and verify the typecheck passes
- [ ] 2.2 Implement catalog validation — price greater than zero, unique slugs,
  known stock values, known unit kinds, and a resolvable category on every
  product — and verify unit tests cover each rejection case
- [ ] 2.3 Implement the loader seam as the single place that returns the product
  array from the static seed file, shaped as a bare array with no wrapper, and
  verify unit tests confirm the loader returns the authored products and passes
  them through validation
- [ ] 2.4 Implement BDT price formatting in one shared helper that renders the `৳`
  symbol before the amount to two decimal places (for example `৳120.00`), and
  verify unit tests assert the symbol-first ordering and that whole-number amounts
  render with `.00` rather than bare
- [ ] 2.5 Author the seed catalog of 20-40 vegetables with a flat set of
  categories, aliases on every product, at least one `out_of_stock` and one
  `low_stock` product, all four unit kinds represented, at least two varieties of
  the same vegetable, and one product deliberately left without an image, with
  plural and regional forms carried as aliases on products whose names are
  singular (search performs no stemming); verify validation passes and a coverage
  test asserts each of those conditions
- [ ] 2.6 Document the product model, the unit-price and price-sorting decisions,
  and the seed authoring rules — including the alias obligation for plural and
  regional forms and the symbol-first price format — in `docs/product-model.md`,
  and verify the documented shapes match the implemented types

## 3. Browse Pipeline

- [ ] 3.1 Implement parsing and serialization of the `q`, `category`, and `sort`
  URL parameters, falling back to defaults on empty, malformed, unknown-category,
  and unknown-sort values, and verify unit tests cover each fallback
- [ ] 3.2 Implement the search matcher — trim, split on whitespace, lowercase, and
  require every token to be contained in the product name or any alias, with no
  stemming or morphological normalization — and verify unit tests cover empty and
  whitespace-only queries returning all products, case-insensitivity, multi-token
  AND semantics, alias matches, a no-match query, the one-directional containment
  rule (`carrot` matches `Carrots`, `carrots` does not match `Carrot`), and a
  plural form resolving only because it is listed as an alias
- [ ] 3.3 Implement category filtering with a derived category list that omits
  categories having no products, and verify unit tests cover the `All` default,
  selecting a category, and resetting to `All`
- [ ] 3.4 Implement price sorting for ascending and descending comparing the total
  sellable-SKU price only, with no normalized unit price or price-per-kilogram
  computed, and equal prices ordered by product name; verify unit tests cover both
  directions, the tie-break ordering, and that products with different selling
  units are ordered by displayed total price without any unit-price normalization
- [ ] 3.5 Implement category counts computed over the search-filtered set,
  ignoring the current category selection, and verify unit tests confirm counts
  narrow as the query narrows
- [ ] 3.6 Compose filtering, category filtering, and sorting into one derivation
  from browse state to the visible product list, and verify unit tests cover
  search-plus-category AND semantics and sorting applied to the filtered set only
- [ ] 3.7 Document the URL parameter contract in `docs/browse-state.md`,
  including each parameter's values, defaults, and fallback behavior, and verify
  the documented contract matches the implemented parsing

## 4. Catalog Page

- [ ] 4.1 Build the product card showing name, image, price with selling unit,
  category, and stock status, and verify component tests assert each field renders
- [ ] 4.2 Render out-of-stock and low-stock treatments on the card — badge plus
  struck-through price for out of stock — and verify component tests cover all
  three stock states
- [ ] 4.3 Implement the image element with a placeholder fallback covering both a
  product with no image and an image that fails to load, and verify component
  tests cover both paths
- [ ] 4.4 Build the search input bound to the `q` URL parameter so typing updates
  the URL and the visible results, and verify a test types a query and observes
  both the URL and the result set change
- [ ] 4.5 Build the single-select category control with `All` as the default,
  derived options, and per-category counts, and verify tests cover selecting a
  category, selecting `All`, and counts reflecting the active query
- [ ] 4.6 Build the sort control defaulting to ascending with both directions
  available, and verify a test changes direction and observes the reordered
  results
- [ ] 4.7 Add the `Clear all` action, shown only when search or category is
  active, clearing both while leaving sort unchanged, and verify tests cover
  visibility, the clearing behavior, and sort preservation
- [ ] 4.8 Display the matching product count and render three distinct states —
  empty catalog, no search results, and data unavailable — with a clear-search
  action in the no-results case, and verify tests cover each state separately
- [ ] 4.9 Make cards keyboard-reachable and activatable with a visible focus
  indicator, and expose the result count to assistive technology on every
  search or filter change; verify tests cover keyboard activation and the
  announced count

## 5. Product Detail Route

- [ ] 5.1 Implement slug lookup over the catalog and the detail page rendering
  name, image, price with selling unit, category, stock status, description,
  origin, storage, preparation, nutrition, allergens, and secondary images, and
  verify tests assert each field renders
- [ ] 5.2 Return a genuine not-found response for an unknown slug rather than
  redirecting or erroring, and verify a test asserts the status and that the
  catalog is not shown instead
- [ ] 5.3 Build the not-found page with a link back to the catalog, and verify a
  test confirms the link is present and resolves
- [ ] 5.4 Render a complete detail page for an out-of-stock product, marked as out
  of stock and offering no purchase action, and verify a test confirms the
  content renders with no purchase control present
- [ ] 5.5 Verify that navigating to a detail page from a searched, filtered, and
  sorted catalog and then returning restores the search query, category
  selection, and sort order

## 6. Integration Verification

- [ ] 6.1 Exercise the full browse flow end to end — open the catalog, search,
  filter by category, change sort, open a product, return to the catalog, and
  confirm state is restored — and verify the end-to-end run passes
- [ ] 6.2 Run typecheck, lint, and the full test suite together and verify all
  three pass clean with no failing or skipped tests
