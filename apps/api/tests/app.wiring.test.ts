import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { ConfigError, loadConfig } from "../src/config/index.js";
import { createHealthRouter } from "../src/routes/health.route.js";
import express from "express";

const prismaStub = {
  product: { count: async () => 37 },
  category: { findMany: async () => [], count: async () => 7 },
  $queryRaw: async () => [{ "?column?": 1 }],
} as never;

describe("GET /health", () => {
  it("reports that the database is reachable", async () => {
    const app = createApp({ prisma: prismaStub, webOrigin: "http://localhost:3000" });
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: "reachable" });
  });

  it("reports a 503 when the database is unreachable", async () => {
    const failing = {
      ...(prismaStub as unknown as object),
      $queryRaw: async () => {
        throw new Error("connection refused");
      },
    } as never;
    const app = createApp({ prisma: failing, webOrigin: "http://localhost:3000" });
    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "degraded", database: "unreachable" });
  });

  it("omits the database error detail from the response", async () => {
    const failing = {
      ...(prismaStub as unknown as object),
      $queryRaw: async () => {
        throw new Error("postgresql://catalog:hunter2@localhost:5432 refused");
      },
    } as never;
    const app = createApp({ prisma: failing, webOrigin: "http://localhost:3000" });
    const response = await request(app).get("/health");

    expect(JSON.stringify(response.body)).not.toContain("hunter2");
    expect(JSON.stringify(response.body)).not.toContain("postgresql://");
  });

  it("is reachable without touching the API surface", async () => {
    const router = createHealthRouter(async () => undefined);
    const app = express();
    app.use("/health", router);

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
  });
});

describe("CORS", () => {
  it("allows the configured development origin", async () => {
    const app = createApp({ prisma: prismaStub, webOrigin: "http://localhost:3000" });

    const allowed = await request(app).get("/api/categories").set("Origin", "http://localhost:3000");
    const rejected = await request(app).get("/api/categories").set("Origin", "http://evil.example.com");

    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("environment validation", () => {
  const complete = { DATABASE_URL: "postgresql://x", WEB_ORIGIN: "http://localhost:3000" };

  it("accepts a complete environment and defaults PORT", () => {
    expect(loadConfig(complete)).toMatchObject({ PORT: 4000, WEB_ORIGIN: "http://localhost:3000" });
  });

  it("rejects an environment missing DATABASE_URL", () => {
    expect(() => loadConfig({ WEB_ORIGIN: "http://localhost:3000" })).toThrow(ConfigError);
  });

  it("rejects an environment missing WEB_ORIGIN", () => {
    expect(() => loadConfig({ DATABASE_URL: "postgresql://x" })).toThrow(ConfigError);
  });

  it("rejects a blank required variable", () => {
    expect(() => loadConfig({ DATABASE_URL: "", WEB_ORIGIN: "http://localhost:3000" })).toThrow(ConfigError);
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => loadConfig({ ...complete, PORT: "not-a-port" })).toThrow(ConfigError);
  });

  it("names every missing variable in one failure", () => {
    try {
      loadConfig({});
      expect.unreachable("loadConfig should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).issues.join(" ")).toContain("DATABASE_URL");
      expect((error as ConfigError).issues.join(" ")).toContain("WEB_ORIGIN");
    }
  });

  it("prevents the server module from booting on an incomplete environment", () => {
    const emptyEnv = { ...process.env };
    delete emptyEnv.DATABASE_URL;
    delete emptyEnv.WEB_ORIGIN;

    expect(() => loadConfig(emptyEnv)).toThrow(ConfigError);
  });
});