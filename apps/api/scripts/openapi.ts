import { z } from "zod";
import { MAX_QUERY_LENGTH, SORT_ORDERS } from "@catalog/product-contract";
import { errorEnvelopeSchema } from "../src/errors/index.js";
import { categoryFacetSchema, categoryListSchema, categorySchema } from "../src/modules/category/category.schema.js";
import { categoryRefSchema, productQuerySchema, productSchema, sellingUnitSchema } from "../src/modules/product/product.schema.js";
import { healthReportSchema } from "../src/routes/health.route.js";

function toJsonSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, { target: "openapi-3.0", io: "output", unrepresentable: "any" });
}

const productListResponseSchema = z.object({
  data: z.array(productSchema),
  meta: z.object({
    matched: z.number().int().nonnegative(),
    catalogTotal: z.number().int().nonnegative(),
    categories: z.array(categoryFacetSchema),
  }),
});

const productDetailResponseSchema = z.object({ data: productSchema });

const slugParamSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const querySchema = toJsonSchema(productQuerySchema) as {
  properties?: Record<string, Record<string, unknown>>;
};

function jsonResponse(schema: z.ZodType, description: string) {
  return { description, content: { "application/json": { schema: toJsonSchema(schema) } } };
}

const errorResponse = jsonResponse(errorEnvelopeSchema, "Error envelope");

export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Product Catalog API",
      version: "1.0.0",
      description:
        "Read-only catalog service. Responses use a data envelope. Listing responses add a meta block carrying both counters, so an empty catalog (catalogTotal 0) can be told apart from a filter that matched nothing (catalogTotal greater than 0, matched 0).",
    },
    servers: [{ url: "http://localhost:4000" }],
    components: {
      schemas: {
        Product: toJsonSchema(productSchema),
        ProductListResponse: toJsonSchema(productListResponseSchema),
        ProductDetailResponse: toJsonSchema(productDetailResponseSchema),
        Category: toJsonSchema(categorySchema),
        CategoryListResponse: toJsonSchema(categoryListSchema),
        CategoryFacet: toJsonSchema(categoryFacetSchema),
        SellingUnit: toJsonSchema(sellingUnitSchema),
        CategoryRef: toJsonSchema(categoryRefSchema),
        ApiErrorEnvelope: toJsonSchema(errorEnvelopeSchema),
        HealthReport: toJsonSchema(healthReportSchema),
      },
    },
    paths: {
      "/api/products": {
        get: {
          summary: "List products",
          description:
            "Returns every matching product, unpaginated, with the number matched, the unfiltered catalog total, and the category options for the current search. Categories with no matching products are omitted.",
          parameters: [
            {
              name: "q",
              in: "query",
              required: false,
              description: `Free-text search across product name and aliases, matched case-insensitively as whole tokens that must all be present. Maximum ${MAX_QUERY_LENGTH} characters.`,
              schema: querySchema.properties?.q ?? { type: "string", maxLength: MAX_QUERY_LENGTH },
            },
            {
              name: "category",
              in: "query",
              required: false,
              description: "Category slug. Combined with q using AND semantics. An unknown slug is rejected.",
              schema: { type: "string", minLength: 1 },
            },
            {
              name: "sort",
              in: "query",
              required: false,
              description: "Sort order for the matched set. Equal prices break on product name ascending.",
              schema: { type: "string", enum: [...SORT_ORDERS], default: "price-asc" },
            },
          ],
          responses: {
            200: jsonResponse(productListResponseSchema, "Matching products with match and catalog counters"),
            400: errorResponse,
            500: errorResponse,
          },
        },
      },
      "/api/products/{slug}": {
        get: {
          summary: "Get a product by slug",
          description: "Returns one product in full, including its stock status. Out-of-stock products are served normally.",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              description: "Lower-case hyphenated product slug.",
              schema: (toJsonSchema(slugParamSchema) as { properties?: Record<string, unknown> }).properties?.slug ?? {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
              },
            },
          ],
          responses: {
            200: jsonResponse(productDetailResponseSchema, "The requested product"),
            400: errorResponse,
            404: errorResponse,
            500: errorResponse,
          },
        },
      },
      "/api/categories": {
        get: {
          summary: "List categories",
          description:
            "Returns every populated category in display order with its unfiltered product count. Empty categories are omitted.",
          responses: {
            200: jsonResponse(categoryListSchema, "Populated categories with counts"),
            500: errorResponse,
          },
        },
      },
      "/health": {
        get: {
          summary: "Service health",
          description: "Reports service status and whether the database is reachable.",
          responses: {
            200: jsonResponse(healthReportSchema, "Service is up and the database is reachable"),
            503: jsonResponse(healthReportSchema, "Service is up but the database is unreachable"),
          },
        },
      },
    },
  };
}

export const openApiDocument = buildOpenApiDocument();