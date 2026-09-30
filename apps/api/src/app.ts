import express from "express";
import cors from "cors";
import type { PrismaClient } from "@prisma/client";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { composeRouters } from "./routes/index.js";
import { createHealthRouter } from "./routes/health.route.js";
import { createCategoryController } from "./modules/category/category.controller.js";
import { createCategoryRepository } from "./modules/category/category.repository.js";
import { createCategoryRouter } from "./modules/category/category.route.js";
import { CategoryService } from "./modules/category/category.service.js";
import { createProductController } from "./modules/product/product.controller.js";
import { createProductRepository } from "./modules/product/product.repository.js";
import { createProductRouter } from "./modules/product/product.route.js";
import { ProductService } from "./modules/product/product.service.js";

export interface AppDependencies {
  prisma: PrismaClient;
  webOrigin: string;
}

export function createApp({ prisma, webOrigin }: AppDependencies): express.Express {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (origin === undefined || origin === webOrigin) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
    }),
  );
  app.use(express.json());

  const categoryService = new CategoryService(createCategoryRepository(prisma));
  const productService = new ProductService(createProductRepository(prisma), createCategoryRepository(prisma));
  const healthRouter = createHealthRouter(() => prisma.$queryRaw`SELECT 1`);

  app.use(
    "/api",
    composeRouters([
      { path: "/products", router: createProductRouter(createProductController(productService)) },
      { path: "/categories", router: createCategoryRouter(createCategoryController(categoryService)) },
    ]),
  );

  app.use("/health", healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}