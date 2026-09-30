import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, errorEnvelope } from "../errors/index.js";

const OPAQUE_INTERNAL_MESSAGE = "An unexpected error occurred.";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.routeNotFound(`No route matches ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json(errorEnvelope(error.code, error.message, error.field));
    return;
  }

  console.error("unhandled error", error);
  res.status(500).json(errorEnvelope("INTERNAL_ERROR", OPAQUE_INTERNAL_MESSAGE));
};