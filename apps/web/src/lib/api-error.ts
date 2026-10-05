import type { ApiSchemas } from "@spot-on-slot/api-client";

export type ApiProblem = ApiSchemas["ProblemDetail"];

export class ApiProblemError extends Error {
  readonly problem: ApiProblem;

  constructor(problem: ApiProblem) {
    super(problem.detail || problem.title || problem.code);
    this.name = "ApiProblemError";
    this.problem = problem;
  }
}

function isProblem(value: unknown): value is ApiProblem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.status === "number";
}

function fallback(code: string, status: number): ApiProblem {
  return { type: "about:blank", title: "", status, code, requestId: "" };
}

/**
 * Normalizes anything thrown or returned as `error` into a problem. Backend problems pass through;
 * texts for network and unknown failures are left empty so the UI uses `errors.<code>` messages.
 */
export function toApiProblem(error: unknown, status?: number): ApiProblem {
  if (error instanceof ApiProblemError) return error.problem;
  if (isProblem(error)) return error;
  if (error instanceof TypeError) return fallback("NETWORK_ERROR", 0);
  return fallback("INTERNAL_ERROR", status ?? 500);
}

/** Returns `data` of an openapi-fetch result or throws an `ApiProblemError`. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    throw new ApiProblemError(toApiProblem(result.error, result.response.status));
  }
  return result.data;
}
