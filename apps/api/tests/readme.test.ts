import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_CODES, MAX_QUERY_LENGTH, SORT_ORDERS } from "@catalog/product-contract";

type Json = Record<string, unknown>;

const readme = await readFile(path.resolve(import.meta.dirname, "..", "README.md"), "utf8");
const openApi = JSON.parse(await readFile(path.resolve(import.meta.dirname, "..", "openapi.json"), "utf8")) as Json;

const paths = openApi.paths as Record<string, { get: { parameters?: Json[]; responses: Record<string, Json> } }>;
const schemas = (openApi.components as { schemas: Json }).schemas as Record<string, Json>;
function parametersOf(routePath: string): Json[] {
  return paths[routePath]?.get.parameters ?? [];
}

function schemaOf(name: string): Json {
  return schemas[name] ?? {};
}

function propertiesOf(schema: Json): Record<string, Json> {
  return (schema.properties as Record<string, Json> | undefined) ?? {};
}

const parameters = parametersOf("/api/products");

describe("the API reference agrees with the OpenAPI document", () => {
  it("documents every listing parameter the OpenAPI document declares", () => {
    for (const parameter of parameters) {
      expect(readme).toContain(`\`${parameter.name}\``);
    }

    const names = [...readme.matchAll(/^\| `(q|category|sort)` \|/gm)].map((match) => match[1]);

    expect(names).toEqual(parameters.map((p) => p.name));
  });

  it("agrees on the query length limit", () => {
    const q = parameters.find((p) => p.name === "q") as { schema: { maxLength?: number } } | undefined;

    expect(readme).toContain(String(MAX_QUERY_LENGTH));
    expect(q?.schema.maxLength).toBe(MAX_QUERY_LENGTH);
  });

  it("agrees on the sort values and default", () => {
    for (const value of SORT_ORDERS) {
      expect(readme).toContain(value);
    }

    expect(readme).toContain("`price-asc`");
  });

  it("documents every error code the OpenAPI document declares", () => {
    const errorFields = propertiesOf(propertiesOf(schemaOf("ApiErrorEnvelope")).error as Json);
    const documented = ((errorFields.code as Json | undefined)?.enum as string[] | undefined) ?? [];

    expect([...documented].sort()).toEqual([...ERROR_CODES].sort());

    for (const code of documented) {
      expect(readme).toContain(code);
    }
  });

  it("documents every endpoint path", () => {
    for (const routePath of Object.keys(paths)) {
      expect(readme).toContain(routePath);
    }
  });

  it("documents both empty-state counters and how to distinguish them", () => {
    expect(readme).toContain("`matched`");
    expect(readme).toContain("`catalogTotal`");
    expect(readme).toContain("empty-state contract");
    expect(readme).toContain("Catalog is empty");
    expect(readme).toContain("Filters matched nothing");
  });

  it("documents every success and failure status the OpenAPI document declares", () => {
    const statuses = new Set<string>();

    for (const item of Object.values(paths)) {
      for (const status of Object.keys(item.get.responses)) {
        statuses.add(status);
      }
    }

    for (const status of statuses) {
      expect(readme).toContain(status);
    }

    const table = readme.slice(readme.indexOf("## Error codes"));

    expect(table).toContain("400");
    expect(table).toContain("404");
    expect(table).toContain("500");
  });
});