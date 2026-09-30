export const ERROR_CODES = [
  "INVALID_QUERY",
  "PRODUCT_NOT_FOUND",
  "ROUTE_NOT_FOUND",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly field?: string;
}

export interface ApiErrorEnvelope {
  readonly error: ApiError;
}