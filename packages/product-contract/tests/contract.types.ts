import { price, type SeedProduct, type SellingUnit } from "../src/index.js";

const kg: SellingUnit = { label: "1 kg", kind: "weight" };

const valid: SeedProduct = {
  slug: "carrot",
  name: "Carrot",
  aliases: ["carrots"],
  description: "Sweet orange root vegetable.",
  price: price(120),
  sellingUnit: kg,
  stockStatus: "in_stock",
  categorySlug: "roots",
};

// A second selling unit has no representation: `sellingUnit` is singular, so a
// `sellingUnits` array is rejected both as a missing property and as excess.
// @ts-expect-error a product may not carry a second selling unit
const twoSellingUnits: SeedProduct = { ...valid, sellingUnits: [kg] };

// The price is branded, so a bare literal is not assignable.
// @ts-expect-error a bare number is not an accepted price
const bareNumber: SeedProduct = { ...valid, price: 120 };

// @ts-expect-error the selling unit kind is a closed set
const unknownKind: SeedProduct = { ...valid, sellingUnit: { label: "1 kg", kind: "volume" } };

// @ts-expect-error the stock status is a closed set
const unknownStock: SeedProduct = { ...valid, stockStatus: "preorder" };

// @ts-expect-error a seed record names its category by slug, not by nested ref
const nestedCategory: SeedProduct = { ...valid, categorySlug: { slug: "roots", name: "Roots", sortOrder: 1 } };

void twoSellingUnits;
void bareNumber;
void unknownKind;
void unknownStock;
void nestedCategory;