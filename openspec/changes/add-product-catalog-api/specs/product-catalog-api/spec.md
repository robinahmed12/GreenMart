# Spec Delta

## Purpose

Serves the read-only vegetable catalog over HTTP: the product and category data
behind it, the listing endpoint with search, category filtering and price
sorting, single-product lookup by slug, and the validation and error rules that
make those responses safe for a client to depend on.

## ADDED Requirements

### Requirement: Product catalog data model

Each product SHALL carry exactly one sellable SKU: a single `price`, a selling
unit `label`, and a selling unit `kind` of `weight`, `count`, `bunch`, or `pack`.

The product's `price` SHALL be the total price of that one sellable SKU, not a
normalized price per unit of weight or count. The system SHALL NOT store or
derive a normalized unit price.

Each product SHALL carry a stable, unique `slug` used as its identity in
requests, a `name`, a `category`, and a `stockStatus`.

#### Scenario: A product exposes exactly one selling unit

- **WHEN** a product is returned by any catalog endpoint
- **THEN** it carries one price and one selling unit with a label and a kind
- **AND** it carries no alternative pack sizes or variants

#### Scenario: Product identity is the slug

- **WHEN** a product is returned by any catalog endpoint
- **THEN** it carries a slug that uniquely identifies it
- **AND** requesting that slug returns that product

#### Scenario: Varieties remain distinct products

- **WHEN** the catalog contains two varieties of the same vegetable
- **THEN** each is a separate product with its own slug, price, and selling unit

### Requirement: Price is a positive decimal amount

Every product's price SHALL be greater than zero and SHALL be represented as a
decimal monetary amount with two decimal places of precision.

The currency SHALL be fixed for the entire catalog and SHALL NOT be stored per
product, since no product deviates from it. The system SHALL NOT accept or return
a currency selection or a converted price.

#### Scenario: Price is a decimal amount

- **WHEN** a product with a price of 120 is returned
- **THEN** its price is represented as the decimal amount `120.00`

#### Scenario: Zero or negative price is rejected

- **WHEN** a price of zero or a negative price is stored or supplied
- **THEN** the write is rejected and the product is not served

#### Scenario: No per-product currency

- **WHEN** a product is returned by any catalog endpoint
- **THEN** it carries a price amount and no currency code or currency selection

### Requirement: Product aliases

Each product SHALL carry a list of aliases: alternative names under which the
same product can be found. An empty list SHALL be valid.

Aliases SHALL be used by search to resolve regional names, British and American
names, and plural forms of singular product names that containment alone cannot
match.

#### Scenario: Product carries an alias list

- **WHEN** a product is returned by any catalog endpoint
- **THEN** it carries a list of aliases, which MAY be empty

#### Scenario: A product may have no aliases

- **WHEN** a product has no alternative names
- **THEN** its alias list is empty and the product is still served and searchable
  by its own name

### Requirement: Product detail data

Each product SHALL carry its `name`, `slug`, `price`, selling unit, `category`,
`stockStatus`, and `description`.

Each product MAY additionally carry `imageUrl`, `images`, `origin`, `storage`,
`preparation`, `nutrition`, and `allergens`. A product with no secondary detail
SHALL still be served with every required field present.

#### Scenario: Required detail fields are always present

- **WHEN** any product is returned by any catalog endpoint
- **THEN** it carries its name, slug, price, selling unit, category, stock status,
  and description

#### Scenario: Product may have an image

- **WHEN** a product has an image assigned
- **THEN** it is returned as an image URL that the client can load
- **AND** a product with no image assigned is still served, without a broken or
  unusable image reference

#### Scenario: Optional detail is absent rather than null

- **WHEN** a product has no secondary detail such as origin or nutrition
- **THEN** the response omits that field or presents it as empty
- **AND** the required fields remain complete

### Requirement: Flat data-driven categories

Each product SHALL belong to exactly one category. Categories SHALL be flat with
no parent-child nesting, and each SHALL carry a `slug`, a display `name`, and an
explicit display `sortOrder`.

The category list SHALL be derived from stored data rather than a hardcoded set.
A category SHALL NOT be offered when it holds no products.

#### Scenario: Product has exactly one category

- **WHEN** a product is returned by any catalog endpoint
- **THEN** it carries exactly one category with a slug, a name, and a display
  order

#### Scenario: Categories are ordered explicitly

- **WHEN** categories are listed
- **THEN** they are returned in ascending display order, not in an incidental or
  alphabetical order

#### Scenario: Empty categories are not offered

- **WHEN** a stored category holds no products
- **THEN** it does not appear in the returned category list or in the category
  options of a listing response

### Requirement: Catalog listing endpoint

The system SHALL expose a catalog listing endpoint returning all products
matching the requested state, together with the number of matches and the total
size of the catalog.

The listing SHALL NOT paginate or split the product set across pages; the
response SHALL carry every matching product.

#### Scenario: Listing returns every matching product

- **WHEN** the listing endpoint is requested with no parameters
- **THEN** every product in the catalog is returned in a single response
- **AND** no page controls, continuation token, or truncated result is included

#### Scenario: Listing reports both counts

- **WHEN** the listing endpoint is requested
- **THEN** the response reports the number of products matching the request and
  the total number of products in the catalog regardless of any filter

#### Scenario: Listing includes category options

- **WHEN** the listing endpoint is requested
- **THEN** the response reports the categories available for the request along
  with the products

### Requirement: Search by product name and aliases

The listing endpoint SHALL accept a `q` query parameter for searching.

Search SHALL be case-insensitive and SHALL split the query on whitespace. Every
token in the query SHALL match, and a product matches a token when the token is
contained in the product's name or in any of the product's aliases. A product is
returned only when all tokens match.

Matching SHALL be containment of the query token within the product's name or
aliases and SHALL NOT be bidirectional: a token shorter than the product text
matches it, while a longer token does not. The system SHALL NOT stem or
otherwise morphologically normalize query tokens or product names.

An absent, empty, or whitespace-only `q` SHALL apply no search filtering.

#### Scenario: Single token matches a product name

- **WHEN** the listing endpoint is requested with `q=carrot`
- **THEN** every product whose name or aliases contain `carrot`, ignoring case,
  is returned

#### Scenario: Search is case-insensitive

- **WHEN** the listing endpoint is requested with `q=CARROT`
- **THEN** the same products are returned as for `q=carrot`

#### Scenario: All tokens must match

- **WHEN** the listing endpoint is requested with `q=cherry tomato`
- **THEN** only products matching both `cherry` and `tomato` are returned

#### Scenario: A shorter token matches a longer product name

- **WHEN** the listing endpoint is requested with `q=carrot`
- **THEN** a product named `Carrots` is returned, because the token is contained
  in the product's name

#### Scenario: A longer token does not match a shorter product name

- **WHEN** the listing endpoint is requested with `q=carrots`
- **THEN** a product named `Carrot` with no `carrots` alias is NOT returned

#### Scenario: An alias resolves to the canonical product

- **WHEN** the listing endpoint is requested with a token matching an alias of a
  product
- **THEN** that product is returned

#### Scenario: Empty search applies no filtering

- **WHEN** the listing endpoint is requested with no `q`, an empty `q`, or a `q`
  containing only whitespace
- **THEN** no search filtering is applied and every product is returned

### Requirement: Category filtering

The listing endpoint SHALL accept a `category` query parameter identifying a
category by slug. Filtering SHALL be single-select: an absent or `all` value
applies no category restriction.

When a category is specified, only products belonging to that category SHALL be
returned, and that restriction SHALL combine with any search using AND semantics.

#### Scenario: Filter to one category

- **WHEN** the listing endpoint is requested with `category=leafy-greens`
- **THEN** only products in that category are returned

#### Scenario: No category filter returns everything

- **WHEN** the listing endpoint is requested with no `category` or with
  `category=all`
- **THEN** products from every category are returned

#### Scenario: Search within a category

- **WHEN** the listing endpoint is requested with `q=carrot` and `category=roots`
- **THEN** only products that both match `carrot` and belong to `roots` are
  returned

#### Scenario: Sorting applies to the filtered set

- **WHEN** the listing endpoint is requested with search and category filters
  and a sort order
- **THEN** the sort is applied to the filtered products only, not to the whole
  catalog

### Requirement: Category counts reflect the active search

The category options reported with a listing SHALL each carry the number of
products that would be returned if that category were selected, given the
request's active search query. Those counts SHALL ignore the category restriction
of the request itself.

#### Scenario: Counts narrow with the search query

- **WHEN** the listing endpoint is requested with `q=carrot`
- **THEN** each reported category count equals the number of products matching
  both that category and `carrot`

#### Scenario: The selected category's count reflects its own restriction

- **WHEN** the listing endpoint is requested with `q=carrot` and `category=roots`
- **THEN** the count reported for `roots` equals the number of products returned
  by that request

#### Scenario: A category with no matches is not offered

- **WHEN** the active search query matches no products in a category
- **THEN** that category is not reported as a category option

### Requirement: Sorting by price

The listing endpoint SHALL accept a `sort` query parameter of `price-asc` or
`price-desc`. An absent value SHALL default to `price-asc`.

Sorting SHALL compare the total price of each product's single sellable SKU and
SHALL NOT represent a normalized unit price, a price per unit of weight, or a
"best value" ranking.

Products with equal prices SHALL be ordered by product name, so that the
ordering is deterministic.

#### Scenario: Default sort is price ascending

- **WHEN** the listing endpoint is requested with no `sort`
- **THEN** products are returned from lowest to highest price

#### Scenario: Descending sort

- **WHEN** the listing endpoint is requested with `sort=price-desc`
- **THEN** products are returned from highest to lowest price

#### Scenario: Price sort is not a value comparison

- **WHEN** products with different selling units are sorted
- **THEN** they are ordered by the total sellable-SKU price
- **AND** the response carries no ranking that indicates better value per unit

#### Scenario: Equal prices are ordered deterministically

- **WHEN** two or more returned products share the same price
- **THEN** they appear in product name order rather than an arbitrary order

### Requirement: Stock status is informational

Each product SHALL carry a `stockStatus` of `in_stock`, `low_stock`, or
`out_of_stock`.

Stock status SHALL be informational only. The system SHALL NOT reserve,
decrement, or modify stock in response to any request, because no purchasing
capability exists.

The system SHALL NOT exclude a product from any listing on the basis of its
stock status.

#### Scenario: Stock status is returned with every product

- **WHEN** any product is returned by any catalog endpoint
- **THEN** it carries a stock status of `in_stock`, `low_stock`, or `out_of_stock`

#### Scenario: Out-of-stock products remain listed

- **WHEN** a product's stock status is `out_of_stock`
- **THEN** it remains present in the default listing, in category listings, and
  in search results
- **AND** its price is returned normally

#### Scenario: Reading does not alter stock

- **WHEN** a listing, search, filter, sort, or single-product request is served
- **THEN** no stock status is changed as a result

#### Scenario: No stock write path exists

- **WHEN** a client attempts any request that would modify a product or its
  stock status
- **THEN** the request is rejected and nothing is changed

### Requirement: Single product lookup by slug

The system SHALL expose a product endpoint addressed by slug, returning that one
product with its complete detail data.

A slug that does not identify any product SHALL produce a not-found response
carrying a `404` status code. The system SHALL NOT redirect, and SHALL NOT
return a success status containing an error.

#### Scenario: Known slug returns the product

- **WHEN** the product endpoint is requested with a slug that exists
- **THEN** that product is returned with its complete detail data and a `200`
  status code

#### Scenario: Out-of-stock product is still served

- **WHEN** the product endpoint is requested with the slug of an out-of-stock
  product
- **THEN** the full product is returned, including its stock status

#### Scenario: Unknown slug returns a 404

- **WHEN** the product endpoint is requested with a slug that does not exist
- **THEN** the response has a `404` status code
- **AND** the response body describes the product as not found
- **AND** no redirect occurs

### Requirement: Category listing endpoint

The system SHALL expose a category listing endpoint returning every category
that holds at least one product, in ascending display order, each with its slug,
name, display order, and total product count unfiltered by any search.

#### Scenario: All populated categories are listed

- **WHEN** the category listing endpoint is requested
- **THEN** every category holding at least one product is returned

#### Scenario: Categories are returned in display order

- **WHEN** the category listing endpoint is requested
- **THEN** categories are returned in ascending display order

#### Scenario: Counts are unfiltered

- **WHEN** the category listing endpoint is requested
- **THEN** each category's product count is its total number of products,
  regardless of any search query

### Requirement: Query parameter validation

The listing endpoint SHALL validate `q`, `category`, and `sort` before serving a
response. Each parameter SHALL be optional, and an absent parameter SHALL take its
default behavior rather than being an error.

A `sort` value outside `price-asc` and `price-desc` SHALL be rejected. A
`category` value that does not identify an existing category SHALL be rejected
rather than ignored or treated as an unfiltered request. A `q` value longer than
a defined maximum length SHALL be rejected.

A rejected request SHALL name the offending parameter and SHALL NOT silently
substitute a default value for it.

#### Scenario: Absent parameters take defaults

- **WHEN** the listing endpoint is requested with no query parameters
- **THEN** no search or category filtering is applied and sort is price
  ascending

#### Scenario: Unknown sort value is rejected

- **WHEN** the listing endpoint is requested with an unrecognized `sort` value
- **THEN** the response is a rejected request naming `sort`
- **AND** no default sort is silently substituted

#### Scenario: Unknown category is rejected

- **WHEN** the listing endpoint is requested with a `category` value that
  identifies no category
- **THEN** the response is a rejected request naming `category`
- **AND** the products of every category are NOT returned as though no category
  had been requested

#### Scenario: Overlong search query is rejected

- **WHEN** the listing endpoint is requested with a `q` value exceeding the
  maximum accepted length
- **THEN** the response is a rejected request naming `q`

### Requirement: Consistent error responses

Every rejected or failed request SHALL produce a response in a single error shape,
carrying an error code, a human-readable message, and, where the failure is
attributable to a specific request parameter, the name of that parameter.

An empty result set SHALL NOT be an error; it SHALL be a successful response
containing no products.

A failure that is not attributable to the request SHALL NOT disclose internal
details such as stack traces, database messages, or the failing query.

#### Scenario: Rejected request uses one error shape

- **WHEN** any request is rejected
- **THEN** the response body carries an error code and message in the same shape
  as every other rejected request

#### Scenario: Parameter failures name the parameter

- **WHEN** a request is rejected because of a specific query parameter
- **THEN** the error response names that parameter

#### Scenario: No matches is a success

- **WHEN** a valid request matches no products
- **THEN** the response has a success status code and contains an empty product
  set

#### Scenario: Internal failures are opaque

- **WHEN** a request fails for a reason not attributable to the request
- **THEN** the response indicates a server failure
- **AND** it discloses no stack trace, database message, or failing query

### Requirement: Catalog data integrity

The catalog data SHALL satisfy the data model invariants at all times: unique
product slugs, prices greater than zero, products belonging to an existing
category, selling unit kinds drawn from the supported set, and stock statuses
drawn from the supported set.

A write that would violate any invariant SHALL be rejected rather than stored.

#### Scenario: Duplicate slug is rejected

- **WHEN** a product is stored with a slug that another product already uses
- **THEN** the write is rejected

#### Scenario: Products must reference an existing category

- **WHEN** a product is stored with a category that does not exist
- **THEN** the write is rejected

#### Scenario: Unsupported selling unit kind is rejected

- **WHEN** a product is stored with a selling unit kind outside the supported set
- **THEN** the write is rejected

#### Scenario: Unsupported stock status is rejected

- **WHEN** a product is stored with a stock status outside the supported set
- **THEN** the write is rejected

### Requirement: Seed catalog data

The system SHALL provide seed data loading a catalog of 20 to 40 products and
their categories, sufficient for every catalog behavior to be exercised,
including at least one product per selling unit kind, at least one product per
stock status, at least one product whose stock status is `out_of_stock`, at least
one pair of products sharing a price, and aliases sufficient to exercise alias
and plural-form matching.

Seed loading SHALL be idempotent: running it against an already-seeded database
SHALL leave exactly one row per slug and category, without failing and without
duplicating data.

Seed data SHALL be validated against the same product contract the API serves, so
that the seed rows, the API's responses, and any client depending on that
contract cannot diverge in shape.

The seed's role SHALL be to populate the catalog in the database. It SHALL NOT be
the long-term source of product data for clients: once a client reads the catalog
from the API, the database is the source of truth and a product present in the
database is served regardless of whether the seed dataset contains it.

#### Scenario: Seed provides a usable catalog

- **WHEN** the database is seeded
- **THEN** 20 to 40 products exist, each belonging to an existing category

#### Scenario: Seed covers every catalog state

- **WHEN** the database is seeded
- **THEN** at least one product exists for each selling unit kind and each stock
  status, including an out-of-stock product

#### Scenario: Seed supports deterministic ordering

- **WHEN** the database is seeded
- **THEN** at least two products share the same price, so that name-based
  tie-breaking is observable

#### Scenario: Seed supports alias matching

- **WHEN** the database is seeded
- **THEN** at least one product carries an alias and at least one carries the
  plural form of a singular name that a query for that plural must match

#### Scenario: Re-seeding is idempotent

- **WHEN** the database is seeded twice
- **THEN** exactly one row exists per product slug and per category, and the
  second run succeeds

#### Scenario: Seed rows conform to the served contract

- **WHEN** seed data is authored
- **THEN** it is validated against the product contract the API serves
- **AND** a seed row that the API would reject is rejected at seed time
- **AND** the served product shape and the client's copy of it are defined by the
  same contract

#### Scenario: The database, not the seed, is the source of truth

- **WHEN** a product is present in the database but absent from the seed dataset
- **THEN** it is served by the catalog endpoints
- **AND** a client reading the catalog from the API does not read product data
  from the seed dataset