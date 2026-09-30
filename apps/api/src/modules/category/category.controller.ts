import type { Request, Response } from "express";
import type { CategoryService } from "./category.service.js";

export function createCategoryController(service: CategoryService) {
  return {
    async list(_req: Request, res: Response): Promise<void> {
      const categories = await service.listCategories();

      res.status(200).json({ data: categories });
    },
  };
}

export type CategoryController = ReturnType<typeof createCategoryController>;