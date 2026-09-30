import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_CODES, MAX_QUERY_LENGTH, SORT_ORDERS, STOCK_STATUSES } from "@catalog/product-contract";
import { buildOpenApiDocument } from "../scripts/openapi.js";

type Json = Record<string, unknown>;

const doc = buildOpenApiDocument() as unknown as Json;
const paths = doc.paths as Record<string, { get: { parameters?: Json[]; responses: Record<string, Json> } }>;
const info = doc.info as Json;

function parametersOf(routePath: string): Json[] {
  return paths[routePath]?.get.parameters ?? [];
}

function schemaOf(name: string): Json {
  const components = doc.components as { schemas: Record<string, Json> };

  return components.schemas[name] as Json;
}

function propertiesOf(schema: Json): Record<string, Json> {
  return schema.properties as Record<string, Json>;
}

function requiredOf(schema: Json): string[] {
  return (schema.required as string[] | undefined) ?? [];
}

function enumOf(schema: Json): string[] {
  return (schema.enum as string[] | undefined) ?? [];
}

function responseSchemaOf(routePath: string, status: string): Json {
  const response = paths[routePath]?.get.responses[status] as Json | undefined;
  const content = response?.content as Record<string, Json> | undefined;

  return (content?.["application/json"]?.schema ?? {}) as Json;
}

async function committedDocument(): Promise<Json> {
  const file = path.resolve(import.meta.dirname, "..", "openapi.json");

  return JSON.parse(await readFile(file, "utf8")) as Json;
}

describe("the generated OpenAPI document", () => {
  it("covers all three API endpoints plus health", () => {
    expect(Object.keys(paths).sort()).toEqual(["/api/categories", "/api/products", "/api/products/{slug}", "/health"]);
  });

  it("is a valid OpenAPI 3.1 document", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(info.title).toBeTruthy();
    expect(info.version).toBeTruthy();
    expect(info.description).toBeTruthy();
  });

  it("documents every listing query parameter with its constraints", () => {
    const parameters = parametersOf("/api/products");

    expect(parameters.map((p) => p.name)).toEqual(["q", "category", "sort"]);

    const q = parameters.find((p) => p.name === "q") as Json;
    expect(q.in).toBe("query");
    expect(q.required).toBe(false);
    expect((q.schema as Json).maxLength).toBe(MAX_QUERY_LENGTH);
    expect(q.description).toContain("aliases");

    const category = parameters.find((p) => p.name === "category") as Json;
    expect(category.in).toBe("query");
    expect((category.schema as Json).minLength).toBe(1);

    const sort = parameters.find((p) => p.name === "sort") as Json;
    expect(enumOf(sort.schema as Json)).toEqual([...SORT_ORDERS]);
    expect((sort.schema as Json).default).toBe("price-asc");
  });

  it("documents the slug path parameter as required", () => {
    const parameters = parametersOf("/api/products/{slug}");

    expect(parameters).toHaveLength(1);
    expect(parameters[0]).toMatchObject({ name: "slug", in: "path", required: true });
    expect(((parameters[0] as Json).schema as Json).pattern).toBe("^[a-z0-9]+(?:-[a-z0-9]+)*$");
  });

  it("documents the product shape including stock status and selling unit", () => {
    const product = schemaOf("Product");
    const properties = propertiesOf(product);

    expect(requiredOf(product)).toEqual(expect.arrayContaining(["slug", "name", "price", "sellingUnit", "stockStatus", "category"]));
    expect(enumOf(properties.stockStatus as Json)).toEqual([...STOCK_STATUSES]);
    expect(enumOf(propertiesOf(properties.sellingUnit as Json).kind as Json)).toEqual(["weight", "count", "bunch", "pack"]);
    expect((properties.price as Json).type).toBe("number");
  });

  it("documents both listing counters", () => {
    const meta = propertiesOf(schemaOf("ProductListResponse")).meta as Json;

    expect(Object.keys(propertiesOf(meta))).toEqual(["matched", "catalogTotal", "categories"]);
    expect(requiredOf(meta)).toEqual(["matched", "catalogTotal", "categories"]);
    expect(info.description).toContain("catalogTotal");
  });

  it("documents the error envelope and every error code", () => {
    const envelope = schemaOf("ApiErrorEnvelope");
    const error = propertiesOf(envelope).error as Json;

    expect(requiredOf(envelope)).toEqual(["error"]);
    expect(enumOf(propertiesOf(error).code as Json)).toEqual([...ERROR_CODES]);
    expect(requiredOf(error)).toEqual(["code", "message"]);
    expect(propertiesOf(error)).toHaveProperty("field");
  });

  it("attaches the error envelope to every failure response on the API endpoints", () => {
    for (const [routePath, item] of Object.entries(paths)) {
      if (!routePath.startsWith("/api/")) {
        continue;
      }

      for (const status of Object.keys(item.get.responses)) {
        if (status === "200") {
          continue;
        }

        expect(propertiesOf(responseSchemaOf(routePath, status) as Json)).toHaveProperty("error");
      }
    }
  });

  it("documents the health failure response as a health report, not an error envelope", () => {
    const schema = propertiesOf(responseSchemaOf("/health", "503") as Json);

    expect(schema).toHaveProperty("database");
    expect(schema).toHaveProperty("status");
    expect(schema).not.toHaveProperty("error");
  });

  it("documents the category shape with its unfiltered count", () => {
    expect(requiredOf(schemaOf("Category"))).toEqual(["slug", "name", "sortOrder", "productCount"]);
    expect(requiredOf(schemaOf("CategoryFacet"))).toEqual(["slug", "name", "sortOrder", "count"]);
    expect(requiredOf(schemaOf("CategoryListResponse"))).toEqual(["data"]);
  });

  it("declares no write operations", () => {
    for (const item of Object.values(paths)) {
      expect(Object.keys(item)).toEqual(["get"]);
    }
  });

  it("matches the committed openapi.json", async () => {
    expect(await committedDocument()).toEqual(JSON.parse(JSON.stringify(doc)));
  });
});