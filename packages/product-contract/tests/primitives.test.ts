import { describe, expect, it } from "vitest";
import { price, MAX_QUERY_LENGTH, SORT_ORDERS, STOCK_STATUSES, SELLING_UNIT_KINDS } from "../src/index.js";

describe("price", () => {
  it("accepts a positive amount", () => {
    expect(price(120)).toBe(120);
    expect(price(0.5)).toBe(0.5);
  });

  it("rejects zero", () => {
    expect(() => price(0)).toThrow(RangeError);
  });

  it("rejects a negative amount", () => {
    expect(() => price(-1)).toThrow(RangeError);
  });

  it("rejects non-finite amounts", () => {
    expect(() => price(Number.NaN)).toThrow(TypeError);
    expect(() => price(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe("closed sets", () => {
  it("mirrors the single sellable SKU model", () => {
    expect(SELLING_UNIT_KINDS).toEqual(["weight", "count", "bunch", "pack"]);
    expect(STOCK_STATUSES).toEqual(["in_stock", "low_stock", "out_of_stock"]);
    expect(SORT_ORDERS).toEqual(["price-asc", "price-desc"]);
  });

  it("defines the accepted search query length", () => {
    expect(MAX_QUERY_LENGTH).toBe(80);
  });
});