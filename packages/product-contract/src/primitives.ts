export const SELLING_UNIT_KINDS = ["weight", "count", "bunch", "pack"] as const;
export type SellingUnitKind = (typeof SELLING_UNIT_KINDS)[number];

export const STOCK_STATUSES = ["in_stock", "low_stock", "out_of_stock"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const SORT_ORDERS = ["price-asc", "price-desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const DEFAULT_SORT_ORDER: SortOrder = "price-asc";

export const MAX_QUERY_LENGTH = 80;

declare const priceBrand: unique symbol;

export type Price = number & { readonly [priceBrand]: "Price" };

export function price(value: number): Price {
  if (!Number.isFinite(value)) {
    throw new TypeError(`price must be a finite number, received ${String(value)}`);
  }
  if (value <= 0) {
    throw new RangeError(`price must be greater than zero, received ${String(value)}`);
  }
  return value as Price;
}

export interface SellingUnit {
  readonly label: string;
  readonly kind: SellingUnitKind;
}