import express from "express";
import { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppError, errorEnvelope } from "../src/errors/index.js";
import { errorHandler, notFoundHandler } from "../src/middleware/error.js";
import { validate } from "../src/middleware/validate.js";
import { composeRouters } from "../src/routes/index.js";
import { z } from "zod";

describe("error envelope factory", () => {
  it("omits the field key for a failure not attributable to a parameter", () => {
    expect(errorEnvelope("PRODUCT_NOT_FOUND", "No product with slug x")).toEqual({
      error: { code: "PRODUCT_NOT_FOUND", message: "No product with slug x" },
    });
    expect("field" in errorEnvelope("PRODUCT_NOT_FOUND", "x").error).toBe(false);
  });

  it("carries the field for a parameterized failure", () => {
    expect(errorEnvelope("INVALID_QUERY", "sort is invalid", "sort")).toEqual({
      error: { code: "INVALID_QUERY", message: "sort is invalid", field: "sort" },
    });
  });

  it("builds envelopes through the AppError helpers", () => {
    expect(AppError.badRequest("q is too long", "q").status).toBe(400);
    expect(AppError.notFound("missing").code).toBe("PRODUCT_NOT_FOUND");
    expect(AppError.routeNotFound("missing").code).toBe("ROUTE_NOT_FOUND");
  });
});

function buildApp() {
  const app = express();
  const router = Router();

  router.get("/boom", () => {
    throw new AppError(418, "INVALID_QUERY", "teapot", "brew");
  });
  router.get("/explode", () => {
    throw new Error("connection to 10.0.0.5 refused: SELECT * FROM products WHERE price > 0");
  });
  router.get("/validated", validate({ query: z.object({ sort: z.enum(["price-asc", "price-desc"]) }) }), (req, res) => {
    res.json({ ok: true, sort: req.query.sort });
  });

  app.use("/api", composeRouters([{ path: "/things", router }]));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("error handling middleware", () => {
  it("returns a 404 envelope for an unmatched path", async () => {
    const response = await request(buildApp()).get("/api/nope");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("returns a thrown AppError with its own status, code, and field", async () => {
    const response = await request(buildApp()).get("/api/things/boom");

    expect(response.status).toBe(418);
    expect(response.body).toEqual({ error: { code: "INVALID_QUERY", message: "teapot", field: "brew" } });
  });

  it("returns an opaque 500 for an unhandled error, leaking no stack, query, or host", async () => {
    const response = await request(buildApp()).get("/api/things/explode");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("10.0.0.5");
    expect(serialized).not.toContain("SELECT");
    expect(serialized).not.toContain("stack");
  });
});

describe("validation middleware", () => {
  it("names the offending query parameter in a 400 envelope", async () => {
    const response = await request(buildApp()).get("/api/things/validated?sort=cheapest");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY");
    expect(response.body.error.field).toBe("sort");
  });

  it("passes a valid parameter through to the handler", async () => {
    const response = await request(buildApp()).get("/api/things/validated?sort=price-desc");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, sort: "price-desc" });
  });
});

describe("router composition", () => {
  it("mounts a module router at its expected path", async () => {
    const response = await request(buildApp()).get("/api/things/validated?sort=price-asc");

    expect(response.status).toBe(200);
  });
});