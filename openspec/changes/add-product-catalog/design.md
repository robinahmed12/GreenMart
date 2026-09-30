# Design

## Context

The repository contains no application source, package manifest, framework, or
test setup — only `openspec/` planning infrastructure. This change therefore has
two jobs: stand up an application skeleton, and build the first capability on
top of it. See `proposal.md` for motivation and
`specs/product-catalog/spec.md` for requirements.

Constraints that shape the approach:

- **Catalog size is bounded.** Roughly 20-40 products. This is the single most
  consequential fact: filtering and sorting the entire catalog in memory is
  instantaneous, which removes the need for server-side search, pagination,
  virtualization, request debouncing, and request cancellation entirely.
- **There is no backend.** Product and stock data is authored in-repository.
  Browse behavior must therefore be defined against a fixed dataset, and the
  dataset's *shape* becomes a contract that a future product API must satisfy.
- **No cart exists yet.** Stock status is display-only, so the catalog has no
  write path and no consistency concerns.
- **The route shape is pre-decided.** `/vegetables/[slug]` implies a routing
  framework with file-based dynamic segments, which pointed at one family of
  frameworks; that selection is now made — see decision 1.

## Goals / Non-Goals

**Goals:**

- One browseable pipeline — filter by search, filter by category, sort — pure and
  synchronous over an in-memory array, with no I/O.
- A product shape that a real product API can satisfy unchanged, isolated behind
  a single loader seam.
- All browse state externalized to the URL, so detail navigation, sharing,
  reload, and back-button behavior are all consequences of one mechanism rather
  than separate features.
- Validation of authored data at build/test time rather than defensive branches
  at render time.

**Non-Goals:**

- Performance engineering for catalog scale. If the catalog grows past a few
  hundred products, the in-memory pipeline is the first thing to revisit.
- Any mutation path for products or stock.
- A reusable framework or design system. The catalog is one page and one detail
  page; abstractions justified by later changes should be introduced then.

## Decisions

### 1. Application stack

**Decision: Next.js App Router with TypeScript.** The `/vegetables/[slug]` route
is App Router syntax, so the request already implies this family. It also
provides file-based routing, static rendering with client-side interactivity for
the browse controls, and a server story later — which cart and checkout will
need for sessions and order persistence — without a rewrite.

**Alternatives considered:** SvelteKit and Remix are equally capable and were
the closest calls. A static site generator plus a client-side router (Astro, or
Vite + React Router in SPA mode) is genuinely simpler for a read-only catalog,
but it forecloses the server-side work the next changes will require, and the
migration cost lands later when the team is mid-feature rather than now while
the surface is two pages.

**This decision affects only the scaffolding task.** The spec is written entirely
in terms of observable behavior and is stack-agnostic; if you prefer a different
framework, the product model, browse pipeline, and all requirements carry over
unchanged.

### 2. One sellable SKU per product; no unit-price normalization

**Decision:** A product carries exactly one price and one selling unit
(`{ label, kind }`). `price` is the total for that SKU. No price-per-kg is ever
computed or displayed.

Sorting by price therefore compares total sellable-SKU price and nothing else.
The resulting order is not a value ranking: it does not express price per
kilogram, a normalized unit price, or "best value", and the UI must not imply
otherwise.

This is the load-bearing decision. Sorting by a raw price across mixed selling
units produces a ranking that reads as false:

```
  Coriander, 1 bunch      ৳8.00    sorts first
  Carrots, 500g           ৳24.00
  Potatoes, 1kg           ৳30.00   sorts last, reads as ~4x the price
                                          of the carrots
```

Normalizing to a common mass would fix `weight` products but is impossible for
`bunch` and `pack`, which have no declared mass — so it would produce a partial,
inconsistent ordering rather than a correct one. Pack-size choice is genuinely a
purchase-time decision and belongs with the cart, not with browsing.

**Alternatives considered:** Multiple pack variants per product with sort by
derived unit price (breaks on `bunch`/`pack`, and makes the card ambiguous about
which price to show); multiple pack variants sorted by raw price (reproduces the
misleading ordering above).

**Accepted cost:** "Sort by best value" is unavailable in this change. When pack
variants arrive with the cart, a `weightGrams` field on `sellingUnit` becomes
possible and unit-price comparison becomes computable for weight products only.

### 3. Three stock states, display-only, nothing hidden

**Decision:** `stock` is one of `in_stock`, `low_stock`, `out_of_stock`. It is
purely presentational. Out-of-stock products remain in the default listing, in
category listings, and in search results, with the price struck through.

Customers search for unavailable produce and return for it; silently removing
those products makes the store look broken and gives a searcher nothing to come
back to. Strike-through rather than hidden price is the honest presentation — it
shows what the item was, which is what a customer comparing today is deciding on.

**Alternatives considered:** A boolean in/out flag (loses the low-stock signal,
which is cheap and useful for merchandising); a fuller lifecycle adding
`out_of_season` and `discontinued` (both require editorial intervention to set
*and* clear, and with a hand-authored seed that is bookkeeping rather than
modeling — deferred, and the field stays open so adding them later is a data and
render change, not a rewrite).

### 4. Search: tokenize, AND, match name plus aliases

**Decision:** Trim the query, split on whitespace, lowercase, and require every
token to be contained in the product's name or in any of its aliases.

```text
tokens(q)   = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
matches(p)  = tokens(q).every(t => haystack(p).includes(t))
haystack(p) = [p.name, ...p.aliases].join(" ").toLowerCase()
```

Alias data is what separates search that feels professional from search that
feels broken. Without it, `aubergine`, `eggplant`, `rocket`, and `arugula` all
return nothing, and the reasonable conclusion is that the store does not stock
them. The cost is one string array per product.

Matching is one-directional containment, not bidirectional: the query token must
appear inside the product text. That means a shorter query can match a longer
name — `carrot` matches `Carrots` — while a longer query will not match a shorter
name — `carrots` does not match `Carrot`:

```
  query "carrot"   vs  product "Carrots"   haystack "carrots"
    "carrots".includes("carrot")  ->  true    MATCH
  query "carrots"  vs  product "Carrot"    haystack "carrot"
    "carrot".includes("carrots")  ->  false   NO MATCH
```

The asymmetry is real and must not be papered over in the documentation. Since
the system performs no stemming, the plural form of a singular product name has
to be carried as an alias on that product. This is the same alias mechanism that
already covers regional and British/American names, so it adds no new structure —
only an authoring obligation.

**Alternatives considered:** Plain substring over the whole name (cheap, but
`cherry tomato` matches nothing because the terms are not adjacent); a fuzzy
matching library (fuzzy on 30 items adds nothing and produces unpredictable
near-misses like `parsnip` → `pea`); server-side search (no server exists, and
the dataset fits in memory).

**Accepted cost:** no stemming and no morphological normalization of either the
query or the product text, so plural and singular forms only match in the
direction containment allows and any remaining gap is closed with aliases. Also
no diacritic folding — irrelevant at present, trivially added if products with
accented names appear.

### 5. Facet counts computed on the search-filtered set

**Decision:** Each category option's count is computed from products that
satisfy the active search query, ignoring the current category selection.

The point of a count is to prevent a customer clicking into a dead end. With
`All` selected and `carrot` in the search box, a count of `1` on Root and `0` on
Leafy tells the truth about what selection will yield. A raw unfiltered count
tells them nothing about their current query.

Because filtering is single-select, counts ignore the current category with no
self-referential ambiguity — the classic "counts shrink as you select" problem
that only arises with multi-select.

### 6. URL is the single source of truth for browse state

**Decision:** `q`, `category`, and `sort` live in the query string. Components
read state from the URL; interactions write to the URL. No component holds a
private copy.

```text
URL  -> parse+validate -> { q, category, sort } -> derive -> render
                                                    |
  interaction -> write to URL ------------------------+
```

This makes four requirements one mechanism instead of four features: filtered
views are shareable, reload restores state, the back button steps through filter
history, and returning from a detail page restores the catalog — because the
catalog URL was never left, it was only navigated away from.

Unrecognized or empty parameter values fall back to defaults rather than erroring,
so hand-edited and stale shared links degrade to a usable page.

**Alternatives considered:** Local component state (breaks sharing, reload, and
back-button behavior, and requires separate state-restoration plumbing for the
detail route); a state library (adds a dependency and a second source of truth
that must be kept in sync with the URL).

### 7. Detail as a route, not a modal or inline expansion

**Decision:** Each product is a real, directly addressable route.

It makes detail pages shareable and indexable, gives each vegetable a stable
identity independent of the catalog, and lets a "not found" slug produce a
genuine 404. A modal cannot be linked to or indexed, and converting one to a
route later means reworking card activation and navigation.

Detail-only fields are additive, which is the cheap direction to be wrong in: a
detail page can ignore a field the data carries, but a card cannot render a
description without becoming unreadable.

### 8. Categories derived from data

**Decision:** Category options are computed from the products themselves. Adding
a category is a data edit; a category with no products never appears as an
option. Categories remain flat — a hierarchy would need a parent field and a
nesting model that none of the browse requirements currently use.

The entity is named `product` rather than `vegetable`, with `category` as data,
so widening the catalog beyond vegetables later is not a rename.

### 9. Static seed behind a single loader seam

**Decision:** Product data is authored as a static file shaped like an API
response — a bare array of product objects, no envelope or wrapper. It is
consumed through one loader function that returns the array.

The loader is the only place that knows where data comes from, so replacing the
static file with a `fetch` later changes one function. The array shape, written
now as a fixture, is the contract a real product API will be held to.

Products are validated at build/test time — price greater than zero, unique
slugs, known `stock` and `sellingUnit.kind` values, every `categoryId`
resolvable. Failing at the boundary means render code contains no defensive
branches for impossible states.

**Alternatives considered:** a CMS or headless commerce backend (adds
infrastructure and an auth story that no current requirement needs); embedding
the seed in component source (no seam to swap, and no validation boundary).

### 10. Deterministic ordering

**Decision:** Price ties break by product name.

Without a tiebreak, equal-price products can reorder between renders as data or
engine internals change, which reads as a bug. `Array.prototype.sort` is stable
in modern engines, so an explicit name comparison guarantees the intended
order rather than relying on input order.

### 11. Currency as a single site-wide constant

**Decision:** BDT, formatted in exactly one place as the `৳` symbol followed by
the amount to two decimal places — `৳120.00`. The symbol precedes the amount
everywhere, on cards and on the detail page.

Symbol-first matches how taka is written in Bangladeshi usage, and pinning the
decimal count keeps `৳8.00` from rendering as `৳8` beside another product's
`৳24.00`, which would read as inconsistent pricing. Multi-currency has no place
in a catalog-only change, and centralizing formatting means a future currency or
format change is one edit. Prices are stored as decimal numbers, never
pre-formatted strings, so sorting and formatting stay separate concerns.

## Risks / Trade-offs

- **The catalog will outgrow the in-memory approach.** At several hundred
  products, client-side filtering stops being free and search quality degrades
  because every keystroke re-filters the whole array → The loader seam means
  this becomes a server-side search endpoint behind the same interface; the
  product model and URL contract do not change.
- **The product shape becomes load-bearing.** A future API must satisfy the seed
  shape exactly, so a poorly chosen field is expensive to change → Keep the shape
  minimal and validate it in one place; add fields additively.
- **Alias coverage is a manual, ongoing data burden.** A product with no aliases
  is unfindable by any name other than its own → Treat aliases as required seed
  data for regional or multi-language names, not optional polish; the field is
  a list so an empty one is always valid.
- **Stock status is decorative.** With no cart, nothing verifies that the
  authored stock values are truthful, so `low_stock` is a merchandising label
  with no system behind it → Accept it for this change; it becomes meaningful
  when a real inventory source replaces the seed.
- **Framework lock-in at the skeleton.** Choosing the stack before any feature
  exists is a guess → Mitigated by keeping all catalog logic framework-agnostic
  and outside route components, so the spec, product model, and browse pipeline
  port to another framework intact.

## Migration Plan

Not applicable — this is the first code in the repository, so there is nothing to
migrate and no existing behavior to preserve. Rollback is deleting the change.

## Open Questions

- **Seed content and imagery.** The specific 20-40 vegetables, their categories,
  prices, and image assets are authoring decisions that do not affect the specs,
  the approach, or the task breakdown, and can be settled while building the
  seed task.
- **Visual design.** Card layout, spacing, typography, and responsive breakpoints
  are unconstrained by the specs and can be settled during implementation.
