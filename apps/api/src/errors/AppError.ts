import { ERROR_CODES, type ApiErrorEnvelope, type ErrorCode } from "@catalog/product-contract";
import { z } from "zod";

export { ERROR_CODES };
export type { ApiErrorEnvelope, ErrorCode };

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    field: z.string().optional(),
  }),
});

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly field: string | undefined;

  constructor(status: number, code: ErrorCode, message: string, field?: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.field = field;
  }

  static badRequest(message: string, field?: string): AppError {
    return new AppError(400, "INVALID_QUERY", message, field);
  }

  static notFound(message: string): AppError {
    return new AppError(404, "PRODUCT_NOT_FOUND", message);
  }

  static routeNotFound(message: string): AppError {
    return new AppError(404, "ROUTE_NOT_FOUND", message);
  }
}

export function errorEnvelope(code: ErrorCode, message: string, field?: string): ApiErrorEnvelope {
  return field === undefined ? { error: { code, message } } : { error: { code, message, field } };
}