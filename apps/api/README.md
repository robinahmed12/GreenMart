# Product Catalog API

Read-only HTTP service over the PostgreSQL catalog. It serves the database as the
source of truth; the seed package only populates it.

Base URL in development: `http://localhost:4000`

## Conventions

- Successful single-resource and list responses use a `data` envelope.
- Failures use an error envelope with a stable code and, where the client can fix
  the request, the offending parameter name.
- There is no pagination. The catalog is small enough to serve whole, and the
  spec deliberately excludes page cursors.

## `GET /api/products`

Lists products matching the supplied filters. Responds 200 on success and 400 on
a rejected parameter.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `q` | string | no | Free-text search, maximum 80 characters. Matched case-insensitively as whole tokens that must all be present. |
| `category` | string | no | Category slug. Combined with `q` using AND semantics. |
| `sort` | `price-asc` \| `price-desc` | no | Sort order for the matched set. Defaults to `price-asc`. |

Search covers the product name and its aliases. Equal prices break on product
name ascending. Out-of-stock products are included; there is no stock filter.

```json
{
  "data": [
    {
      "slug": "carrot",
      "name": "Carrot",
      "aliases": ["carrots"],
      "description": "...",
      "price": 480,
      "sellingUnit": { "label": "1 kg", "kind": "weight" },
      "stockStatus": "in_stock",
      "category": { "slug": "roots", "name": "Roots", "sortOrder": 2 }
    }
  ],
  "meta": {
    "matched": 2,
    "catalogTotal": 37,
    "categories": [
      { "slug": "roots", "name": "Roots", "sortOrder": 2, "count": 2 }
    ]
  }
}
```

### `meta`

| Field | Meaning |
| --- | --- |
| `matched` | Number of products returned. |
| `catalogTotal` | Total products in the catalog, ignoring every filter. |
| `categories` | Category options for the current search, with the count each would yield. |

### The two-counter empty-state contract

`matched` and `catalogTotal` answer different questions, so the caller never
needs a second request to tell the two empty cases apart:

| Situation | `matched` | `catalogTotal` |
| --- | --- | --- |
| Filters matched some products | `> 0` | `>= matched` |
| Catalog is empty | `0` | `0` |
| Filters matched nothing, catalog is not empty | `0` | `> 0` |

`meta.categories` reflects the current `q` only. A requested `category` does not
narrow the options, so the caller can still switch category. Categories with no
matching products are omitted, which is what makes a zero-count selection
observable: requesting a category whose own count is zero returns an empty
`categories` array.

## `GET /api/products/{slug}`

Returns one product in full. `slug` must be lower-case and hyphenated; anything
else is a 400.

```json
{ "data": { "slug": "bok-choy", "name": "Bok Choy", "...": "..." } }
```

An unknown slug is a 404 with no redirect.

## `GET /api/categories`

Returns populated categories in display order with unfiltered counts. Empty
categories are omitted.

```json
{
  "data": [
    { "slug": "leafy-greens", "name": "Leafy Greens", "sortOrder": 1, "productCount": 7 }
  ]
}
```

These counts ignore any search filter, unlike `meta.categories` on the listing
endpoint.

## `GET /health`

Reports service status and database reachability. Returns 503 when the database
cannot be reached. Connection details are never included in the body.

```json
{ "status": "ok", "database": "reachable" }
```

## Error codes

Every failure returns:

```json
{ "error": { "code": "INVALID_QUERY", "message": "...", "field": "sort" } }
```

| Code | Status | Raised when | `field` |
| --- | --- | --- | --- |
| `INVALID_QUERY` | 400 | A query or path parameter is rejected. No default is silently substituted. | The offending parameter, or omitted when not parameter-specific. |
| `PRODUCT_NOT_FOUND` | 404 | The product slug resolves to no row. | Omitted. |
| `ROUTE_NOT_FOUND` | 404 | No route matches the request, including any non-read method on a read path. The API exposes no write surface. | Omitted. |
| `INTERNAL_ERROR` | 500 | An unexpected failure. | Omitted. |

Unrecognized `sort` values and unknown `category` slugs are rejected rather than
replaced with a default, so a client bug surfaces instead of being masked.

## Reference

`openapi.json` in this directory is generated from the feature-local Zod schemas
by `npm run openapi --workspace @catalog/api`. `tests/openapi.test.ts` fails if
the committed document drifts from the schemas.