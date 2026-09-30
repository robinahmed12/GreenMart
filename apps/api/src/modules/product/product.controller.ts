import type { Request, Response } from "express";
import { productQuerySchema } from "./product.schema.js";
import type { ProductService } from "./product.service.js";

function single(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function createProductController(service: ProductService) {
  return {
    async list(req: Request, res: Response): Promise<void> {
      const parsed = productQuerySchema.parse(req.query);

      const listing = await service.listProducts({
        q: single(parsed.q),
        category: single(parsed.category),
        sort: single(parsed.sort),
      });

      res.status(200).json(listing);
    },

    async detail(req: Request, res: Response): Promise<void> {
      const slug = single(req.params.slug) ?? "";

      const product = await service.getProductBySlug(slug);

      res.status(200).json({ data: product });
    },
  };
}

export type ProductController = ReturnType<typeof createProductController>;