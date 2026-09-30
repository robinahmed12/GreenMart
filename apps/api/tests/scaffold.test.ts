import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, prisma } from "./helpers/app.js";

const app = buildTestApp();

describe("app scaffold", () => {
  it("serves the health route", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: "reachable" });
  });

  it("returns a 404 error envelope for an unmatched path", async () => {
    const response = await request(app).get("/api/nope");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("allows the configured frontend origin through CORS", async () => {
    const response = await request(app).get("/health").set("Origin", "http://localhost:3000");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("reaches the database", async () => {
    await expect(prisma.product.count()).resolves.toBeGreaterThan(0);
  });
});