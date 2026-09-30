import { Router } from "express";
import type { CategoryController } from "./category.controller.js";

export function createCategoryRouter(controller: CategoryController): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    void controller.list(_req, res).catch(next);
  });

  return router;
}