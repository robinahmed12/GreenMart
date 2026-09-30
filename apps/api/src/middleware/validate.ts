import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/index.js";

export interface ValidationTargets {
  query?: ZodType;
  params?: ZodType;
}

export function validate(targets: ValidationTargets): RequestHandler {
  return (req, _res, next) => {
    const parsedQuery = targets.query === undefined ? undefined : targets.query.safeParse(req.query);
    const parsedParams = targets.params === undefined ? undefined : targets.params.safeParse(req.params);

    if (parsedQuery !== undefined && !parsedQuery.success) {
      const issue = parsedQuery.error.issues[0];
      next(AppError.badRequest(issue?.message ?? "Invalid query parameter.", issue?.path.join(".") || "query"));
      return;
    }

    if (parsedParams !== undefined && !parsedParams.success) {
      const issue = parsedParams.error.issues[0];
      next(AppError.badRequest(issue?.message ?? "Invalid path parameter.", issue?.path.join(".") || "params"));
      return;
    }

    if (parsedQuery !== undefined && parsedQuery.success) {
      Object.assign(req.query, parsedQuery.data);
    }
    if (parsedParams !== undefined && parsedParams.success) {
      Object.assign(req.params, parsedParams.data);
    }

    next();
  };
}