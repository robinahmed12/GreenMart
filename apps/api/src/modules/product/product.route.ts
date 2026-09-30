import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { productQuerySchema } from "./product.schema.js";
import type { ProductController } from "./product.controller.js";

const slugParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be a lower-case hyphenated identifier"),
});

export function createProductRouter(controller: ProductController): Router {
  const router = Router();

  router.get("/", validate({ query: productQuerySchema }), (req, res, next) => {
    void controller.list(req, res).catch(next);
  });

  router.get("/:slug", validate({ params: slugParamsSchema }), (req, res, next) => {
    void controller.detail(req, res).catch(next);
  });

  return router;
}