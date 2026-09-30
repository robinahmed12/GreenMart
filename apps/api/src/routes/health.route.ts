import { Router } from "express";

import { z } from "zod";

export type DatabaseProbe = () => Promise<unknown>;

export const healthReportSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["reachable", "unreachable"]),
});

export type HealthReport = z.infer<typeof healthReportSchema>;

export function createHealthRouter(probe: DatabaseProbe): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    void (async () => {
      let database: HealthReport["database"];

      try {
        await probe();
        database = "reachable";
      } catch {
        database = "unreachable";
      }

      const report: HealthReport = { status: database === "reachable" ? "ok" : "degraded", database };

      res.status(database === "reachable" ? 200 : 503).json(report);
    })().catch(next);
  });

  return router;
}