# Proposal

## Why

The vegetable store has no way for a customer to see what it sells. The first
customer-facing capability is browsing: without a catalog there is nothing to
find, evaluate, or open. This change establishes the catalog as the foundation
that cart, checkout, and orders later build on, and settles the product model
those later changes will depend on.

Vegetables are not a generic product domain, and two fields behave differently
here than they would for, say, electronics:

- **Price is only meaningful relative to the selling unit.** A bunch of
  coriander and a kilogram of potatoes are not comparable as bare numbers. This
  change fixes `price` as the total price of a single sellable SKU and keeps unit
  normalization out of scope, so "sort by price" orders products by a price the
  customer can actually see, rather than by a derived figure that does not exist
  on the page. Sorting by total price is not a value comparison.
- **Stock is a display concern, not a transaction.** Produce goes out of stock
  routinely and customers search for unavailable items, so out-of-stock products
  stay visible and marked rather than disappearing.

Because there is no cart in this change, stock status is purely informational —
nothing is reserved, decremented, or blocked.

## What Changes

- Add a browseable catalog of approximately 20-40 seed vegetables.
- Each product exposes exactly one sellable SKU: `price` is the total price of
  that SKU, paired with a selling unit carrying a display `label` and a `kind`
  (`weight`, `count`, `bunch`, `pack`).
- Prices are BDT, rendered as the `৳` symbol followed by the amount to two
  decimal places (for example `৳120.00`), at a single fixed site-wide currency.
  No multi-currency.
- Each product card shows name, image, price, selling unit, category, and stock
  status.
- Customers can search by vegetable name, filter by category, and sort by total
  sellable-SKU price ascending or descending. Sorting compares total SKU price
  only and is not a value or price-per-kilogram comparison.
- Search is case-insensitive, splits the query on whitespace, and requires every
  token to be contained in the product name **and** per-product aliases so
  regional and British/American names both resolve. Matching is one-directional
  containment — a shorter query can match a longer name, but a longer query will
  not match a shorter one — so alternative plural forms are covered by aliases
  rather than by stemming.
- Categories are flat and data-driven; category filtering is single-select with
  `All` as the default, and facet counts reflect the active search query.
- Out-of-stock products remain visible in all browse views, marked on the card,
  with the price struck through.
- Products open on a separate, shareable detail route at `/vegetables/[slug]`
  carrying description, origin, storage instructions, preparation tips,
  nutrition, allergens, and secondary images.
- Browser state — `q`, `category`, `sort` — lives in the URL, so filtered views
  are shareable, the back button behaves, and returning from a detail page
  preserves the catalog state.
- An unknown slug returns a real 404 page rather than a redirect or an error.
- Missing images render a placeholder rather than a broken image.
- Seed data is validated: prices must be greater than zero, slugs must be
  unique, and a `Clear all` control appears whenever search or category
  filtering is active.

### Explicitly out of scope

Cart, checkout, payments, authentication, orders, admin product management,
stock modification, reviews, subscription boxes, multi-currency, multiple pack
sizes per vegetable, seasonal stock states, a discontinued-product lifecycle,
harvest dates, and pagination.

## Capabilities

### New Capabilities

- `product-catalog`: Browsing the vegetable catalog — product data model and
  selling units, catalog listing with cards, name search over aliases,
  single-select category filtering with facet counts, price sorting, URL-backed
  browse state, and the per-product detail route.

### Modified Capabilities

None. This is the first capability in the project.

## Impact

- **New code, greenfield.** No application source, package manifest, or
  framework currently exists in this repository; this change also stands up the
  application skeleton it needs.
- **Stack: Next.js App Router with TypeScript.** Selected in `design.md`
  decision 1 and consistent with the `/vegetables/[slug]` route shape. No
  application framework is currently present in this repository, so this change
  introduces it.
- **No backend, no network calls.** Catalog data is a static, API-shaped seed
  file consumed directly. Search, filter, and sort all run client-side against
  the in-memory product array, so there is no server, no database, and no
  request-cancellation or debounce logic.
- **Seed data becomes a contract.** The product shape written for the static
  file is the shape a future product API must satisfy, so replacing the seed
  with a fetch later should change only the loader.
- **No breaking changes** — nothing exists to break.
