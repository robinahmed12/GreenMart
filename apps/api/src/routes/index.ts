import type { Router } from "express";
import { Router as createRouter } from "express";

export interface ModuleRouter {
  path: string;
  router: Router;
}

export function composeRouters(modules: readonly ModuleRouter[]): Router {
  const router = createRouter();

  for (const module of modules) {
    router.use(module.path, module.router);
  }

  return router;
}