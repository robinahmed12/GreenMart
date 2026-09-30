import type { Price, SellingUnit, StockStatus } from "./primitives.js";
import type { CategoryRef } from "./category.js";

export interface SecondaryDetails {
  readonly imageUrl?: string;
  readonly images?: readonly string[];
  readonly origin?: string;
  readonly storage?: string;
  readonly preparation?: string;
  readonly nutrition?: string;
  readonly allergens?: readonly string[];
}

export interface Product extends SecondaryDetails {
  readonly slug: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly price: number;
  readonly sellingUnit: SellingUnit;
  readonly stockStatus: StockStatus;
  readonly category: CategoryRef;
}

export interface SeedProduct extends SecondaryDetails {
  readonly slug: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly price: Price;
  readonly sellingUnit: SellingUnit;
  readonly stockStatus: StockStatus;
  readonly categorySlug: string;
}