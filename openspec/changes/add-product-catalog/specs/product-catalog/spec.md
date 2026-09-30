# Spec Delta

## Purpose

Lets customers browse the vegetable catalog: find a vegetable by name, narrow
results by category, sort by price, and open a product to see its full details.

## ADDED Requirements

### Requirement: Sellable unit model

Each vegetable SHALL be represented by exactly one sellable SKU carrying one
selling unit. A selling unit MUST consist of a display `label` and a `kind`,
where `kind` is one of `weight`, `count`, `bunch`, or `pack`.

The product's `price` SHALL be the total price of that single sellable SKU, not
a normalized price per unit of weight or count. The system SHALL NOT derive or
display a normalized price.

Distinct varieties of the same vegetable SHALL be separate products with their
own identity and their own price and selling unit.

#### Scenario: Product exposes exactly one selling unit

- **WHEN** a customer views any vegetable
- **THEN** the vegetable shows one price and one selling unit label
- **AND** no alternative pack sizes are offered anywhere on the page

#### Scenario: All supported selling unit kinds are displayable

- **WHEN** a vegetable's selling unit has `kind` of `weight`, `count`, `bunch`, or `pack`
- **THEN** the selling unit label is displayed alongside the price

#### Scenario: Similar varieties remain distinct

- **WHEN** the catalog contains two varieties of the same vegetable, such as a round tomato and a plum tomato
- **THEN** each appears as its own product with its own price and selling unit

### Requirement: Price display and currency

All prices SHALL be displayed in Bangladeshi Taka (BDT) as the `৳` symbol
followed by the amount, rendered to two decimal places — for example `৳120.00`.
The symbol SHALL precede the amount in every price presentation, on cards and on
the detail page alike.

The currency SHALL be fixed site-wide, and the system SHALL NOT offer currency
selection or conversion.

#### Scenario: Price renders with the taka symbol before the amount

- **WHEN** a product with a price is displayed
- **THEN** the price is rendered as the `৳` symbol followed by the amount to two
  decimal places, for example `৳120.00`

#### Scenario: Presentation is consistent across views

- **WHEN** a product's price is shown on a catalog card and on its detail page
- **THEN** both render the price in the same symbol-first, two-decimal format

#### Scenario: No currency choice is presented

- **WHEN** a customer browses the catalog
- **THEN** no currency selector or converted price is shown anywhere

### Requirement: Stock status is display-only

Each product SHALL carry a stock status of `in_stock`, `low_stock`, or
`out_of_stock`. Stock status SHALL be informational only: the system SHALL NOT
reserve, decrement, or modify stock in response to customer activity, because
no purchasing capability exists.

The system SHALL NOT hide products from any browse view on the basis of stock
status.

#### Scenario: In-stock product carries no badge

- **WHEN** a product's stock status is `in_stock`
- **THEN** it is presented identically to other available products with no stock badge

#### Scenario: Low-stock product is badged but remains available

- **WHEN** a product's stock status is `low_stock`
- **THEN** the product displays a low-stock badge
- **AND** the product remains visible and browsable like any other product

#### Scenario: Out-of-stock product stays visible and is marked

- **WHEN** a product's stock status is `out_of_stock`
- **THEN** the product remains present in the default listing, in category
  listings, and in search results
- **AND** it is marked as out of stock on its card
- **AND** its price is displayed struck through rather than hidden

#### Scenario: Browsing does not alter stock

- **WHEN** a customer views, searches, filters, sorts, or opens a product
- **THEN** no stock quantity or stock status is changed as a result

### Requirement: Catalog listing

The catalog SHALL present all products as a list of cards. Each card SHALL show
the product's name, image, price, selling unit, category, and stock status.

The catalog SHALL NOT paginate, infinite-scroll, or otherwise split the product
list across pages.

#### Scenario: Card shows the catalog fields

- **WHEN** the catalog listing is displayed
- **THEN** each product card shows its name, image, price, selling unit,
  category, and stock status

#### Scenario: Entire catalog renders without paging

- **WHEN** a customer opens the catalog
- **THEN** every matching product is shown without page controls or a load-more control

#### Scenario: Product count is reported

- **WHEN** the catalog is filtered by search and category
- **THEN** the number of matching products is displayed

### Requirement: Product image placeholder

A product without a usable image SHALL render a placeholder in place of the
image. The system SHALL NOT render a broken-image indicator.

#### Scenario: Product with no image

- **WHEN** a product has no image assigned
- **THEN** a placeholder is displayed in the product's image area

#### Scenario: Image fails to load

- **WHEN** a product's image is assigned but fails to load
- **THEN** the placeholder is displayed instead of a broken image

### Requirement: Search by vegetable name

The system SHALL allow customers to search the catalog by vegetable name.
Search SHALL be case-insensitive and SHALL split the query on whitespace. Every
token in the query SHALL match, and a product matches a token when the token is
contained in the product's name or in any of the product's aliases. A product is
a result only when all tokens match.

Matching SHALL be containment of the query token within the product's name or
aliases, and SHALL NOT be bidirectional: a token shorter than the product text
matches it, but a token longer than the product text does not. The system SHALL
NOT stem or otherwise morphologically normalize query tokens or product names.

Products SHALL support aliases so that regional, British, and American names
resolve to the same product. Alternative forms that containment alone will not
match — including plural forms of a singular product name — SHALL be expressed as
aliases on that product.

#### Scenario: Single token matches a product name

- **WHEN** a customer searches for `carrot`
- **THEN** every product whose name or aliases contain `carrot`, ignoring case,
  is shown

#### Scenario: Search is case-insensitive

- **WHEN** a customer searches for `CARROT`
- **THEN** the same products are shown as for a search of `carrot`

#### Scenario: All tokens must match

- **WHEN** a customer searches for `cherry tomato`
- **THEN** only products matching both `cherry` and `tomato` are shown

#### Scenario: Alias resolves to the canonical product

- **WHEN** a customer searches using an alias of a product, such as a regional or alternative name
- **THEN** that product is shown as a result

#### Scenario: A shorter token matches a longer product name

- **WHEN** a customer searches for `carrot`
- **THEN** a product named `Carrots` is shown, because the token is contained in
  the product's name

#### Scenario: A longer token does not match a shorter product name

- **WHEN** a customer searches for `carrots`
- **THEN** a product named `Carrot` with no `carrots` alias is NOT shown

#### Scenario: Alternative plural forms resolve through aliases

- **WHEN** a customer searches for `carrots`
- **THEN** a product named `Carrot` is shown if `carrots` is listed among that
  product's aliases, and is not shown otherwise

#### Scenario: Empty search shows the full catalog

- **WHEN** the search query is empty or contains only whitespace
- **THEN** all products are shown
- **AND** no search filtering is applied

#### Scenario: No matching products

- **WHEN** a search query matches no products
- **THEN** an empty-result message is shown that states no vegetables matched
- **AND** an action to clear the search is offered
- **AND** any active category filter remains applied and visible

### Requirement: Category filtering

Categories SHALL be a flat list derived from the products themselves rather
than a hardcoded set. Each product SHALL belong to exactly one category.

Category filtering SHALL be single-select. Selecting no category is represented
as `All`, which shows every product. Selecting a category shows only products in
that category.

#### Scenario: Filter to one category

- **WHEN** a customer selects a category
- **THEN** only products in that category are shown

#### Scenario: All is the default

- **WHEN** a customer opens the catalog with no category selected
- **THEN** `All` is the active option and products from every category are shown

#### Scenario: Selecting All clears the category restriction

- **WHEN** a customer selects `All` after selecting a category
- **THEN** products from every category are shown

#### Scenario: Categories come from the data

- **WHEN** a category has no products in the catalog
- **THEN** that category does not appear as a filter option

### Requirement: Category counts reflect the active search

Each category option SHALL display the number of products that would be shown
if the customer selected that category, given the currently active search query.

#### Scenario: Counts narrow with the search query

- **WHEN** a customer has entered a search query and views the category options
- **THEN** each category's displayed count equals the number of products matching
  both that category and the active search query

### Requirement: Combining search and category filtering

Search and category filtering SHALL combine with AND semantics. A product is
shown only when it satisfies the search query and, if a category is selected,
belongs to that category.

#### Scenario: Search within a category

- **WHEN** a customer searches for `carrot` while `Root` is selected
- **THEN** only products that both match `carrot` and belong to `Root` are shown

#### Scenario: Search with All categories

- **WHEN** a customer searches with `All` selected
- **THEN** only products matching the search query are shown, across all categories

### Requirement: Sorting by price

Customers SHALL be able to sort the catalog by price ascending or descending. The
default sort order SHALL be price ascending. Products with equal prices SHALL be
ordered by product name so that ordering is deterministic.

Sorting SHALL compare the total price of each product's single sellable SKU, and
SHALL NOT represent a normalized unit price, a price per kilogram, or a "best
value" ranking.

Sorting SHALL apply to the set of products remaining after search and category
filtering.

#### Scenario: Default sort is price ascending

- **WHEN** a customer opens the catalog with no sort selection
- **THEN** products are ordered from lowest to highest price

#### Scenario: Descending sort

- **WHEN** a customer selects descending price sort
- **THEN** products are ordered from highest to lowest price

#### Scenario: Price sort is not a value comparison

- **WHEN** products with different selling units are sorted by price
- **THEN** they are ordered by the total sellable-SKU price shown to the customer
- **AND** the ordering does not indicate which product is better value per unit

#### Scenario: Sort applies to the filtered set

- **WHEN** a customer has filtered the catalog and then changes the sort order
- **THEN** the sort is applied to the filtered products only, not to the whole catalog

#### Scenario: Equal prices are ordered deterministically

- **WHEN** two or more filtered products share the same price
- **THEN** they appear in product name order rather than in an arbitrary order

### Requirement: Browse state is held in the URL

The catalog SHALL hold the active search query, selected category, and sort
order in the URL so that a filtered view can be shared or bookmarked and
restored. The URL parameters SHALL be `q`, `category`, and `sort`.

The system SHALL ignore unrecognized or empty parameter values, falling back to
the default state rather than failing.

#### Scenario: Filtering updates the URL

- **WHEN** a customer searches or changes the category or sort order
- **THEN** the resulting state is reflected in the URL

#### Scenario: Shared URL restores the view

- **WHEN** a customer opens a catalog URL that contains a search query, category, and sort order
- **THEN** the catalog is shown with exactly that state applied

#### Scenario: Unknown parameter values fall back to defaults

- **WHEN** a customer opens a catalog URL with an unrecognized sort value or an unknown category
- **THEN** the catalog is shown using default values for those parameters

#### Scenario: Default URL has no parameters

- **WHEN** a customer opens the catalog with no parameters
- **THEN** no search or category filtering is applied and sort is price ascending

### Requirement: Clear all action

The system SHALL offer a `Clear all` action whenever a search query or a
category selection is active. Activating it SHALL clear both the search query
and the category selection and SHALL leave the sort order unchanged.

#### Scenario: Clear all appears only when needed

- **WHEN** the catalog is displayed
- **THEN** a `Clear all` action is shown when a search query or a category is
  active, and is not shown when neither is

#### Scenario: Clear all resets both filters

- **WHEN** a customer activates `Clear all`
- **THEN** the search query is cleared and the category selection returns to `All`

#### Scenario: Clear all preserves sort order

- **WHEN** a customer with a non-default sort order activates `Clear all`
- **THEN** the selected sort order is unchanged

### Requirement: Product detail route

Each product SHALL be openable on its own route, identified by its slug, which
is stable and unique. The detail page SHALL present the product's name, image,
price, selling unit, category, stock status, description, origin, storage
instructions, preparation tips, nutrition information, allergens, and secondary
images.

The detail route SHALL be directly addressable, so that its URL can be shared,
bookmarked, and reloaded.

#### Scenario: Opening a product from the catalog

- **WHEN** a customer activates a product card in the catalog
- **THEN** the product's detail page is displayed

#### Scenario: Detail page presents product information

- **WHEN** a product's detail page is displayed
- **THEN** it shows the product's name, image, price, selling unit, category,
  stock status, description, origin, storage instructions, preparation tips,
  nutrition information, allergens, and secondary images

#### Scenario: Detail route is directly addressable

- **WHEN** a customer opens a product's detail URL directly, without visiting the catalog first
- **THEN** the product's detail page is displayed

#### Scenario: Detail URL is shareable and stable

- **WHEN** a customer copies a product's detail URL and opens it later
- **THEN** the same product's detail page is displayed

### Requirement: Detail page preserves catalog state

Returning from a product's detail page to the catalog SHALL restore the search
query, category selection, and sort order that were active before the product
was opened.

#### Scenario: Returning restores the previous view

- **WHEN** a customer opens a product from a filtered and sorted catalog and then returns to the catalog
- **THEN** the catalog is shown with the same search query, category selection,
  and sort order

### Requirement: Detail page for an out-of-stock product

A product whose stock status is `out_of_stock` SHALL still have a complete
detail page, and that page SHALL present the product's stock status. The page
SHALL NOT offer any purchase action.

#### Scenario: Out-of-stock detail page is complete

- **WHEN** a customer opens the detail page of an out-of-stock product
- **THEN** the full product information is displayed
- **AND** the product is marked as out of stock
- **AND** no purchase action is offered

### Requirement: Unknown product slug

A request for a product slug that does not exist in the catalog SHALL return a
not-found page. The system SHALL NOT redirect to the catalog, and SHALL NOT
display an unhandled error.

#### Scenario: Unknown slug returns a not-found page

- **WHEN** a customer opens a product detail URL with a slug that does not exist
- **THEN** a not-found page is displayed

#### Scenario: Not-found page offers a way back

- **WHEN** a customer is shown a not-found page for an unknown product
- **THEN** the page offers a way back to the catalog

### Requirement: Catalog data validity

Every product in the catalog SHALL have a price greater than zero, and slugs
SHALL be unique across all products. A catalog violating either rule SHALL be
treated as invalid.

#### Scenario: Zero or negative price is invalid

- **WHEN** a product's price is zero or negative
- **THEN** the catalog data is treated as invalid

#### Scenario: Duplicate slug is invalid

- **WHEN** two products share the same slug
- **THEN** the catalog data is treated as invalid

### Requirement: Empty and unavailable catalog states

The system SHALL distinguish between a catalog that contains no products and a
filtered view that matched no products, and SHALL present a distinct message for
each.

#### Scenario: Catalog contains no products

- **WHEN** the catalog contains no products at all
- **THEN** a message states that the catalog is currently unavailable

#### Scenario: Filter matched no products

- **WHEN** products exist but the active search and category match none of them
- **THEN** a message states that no vegetables matched the current filters
- **AND** the message is distinguishable from the empty-catalog message

### Requirement: Catalog accessibility

Product cards SHALL be reachable and operable by keyboard, with a visible focus
indicator. When search or category filtering changes the number of results, the
system SHALL make the new result count available to assistive technology.

#### Scenario: Cards are keyboard operable

- **WHEN** a customer navigates the catalog using only a keyboard
- **THEN** each product card can be focused and opened
- **AND** the focused card shows a visible focus indicator

#### Scenario: Result count is announced

- **WHEN** a change in search or category filtering alters the number of results
- **THEN** the new result count is exposed to assistive technology
