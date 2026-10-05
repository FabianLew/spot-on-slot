import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema";

export type { components, paths };
export type ApiSchemas = components["schemas"];

/** Thrown when a request never got a response (offline, DNS, CORS, connection reset). */
export class NetworkError extends Error {
  readonly code = "NETWORK_ERROR";
  readonly status = 0;

  constructor(options?: ErrorOptions) {
    super("Network request failed", options);
    this.name = "NetworkError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Active UI language; sent as `Accept-Language` so the backend localizes problem texts. */
  getLocale?: () => string | undefined;
}

/**
 * Typed client generated from the backend OpenAPI spec.
 * Shared by the web app and, later, the Expo mobile app.
 */
export function createApiClient({ baseUrl, getAccessToken, getLocale }: ApiClientOptions) {
  const client = createClient<paths>({ baseUrl });

  // Only a failed `fetch` reaches onError, so this is the one place a network failure is recognised.
  const network: Middleware = {
    onError({ error }) {
      return new NetworkError({ cause: error });
    },
  };
  client.use(network);

  if (getAccessToken) {
    const auth: Middleware = {
      async onRequest({ request }) {
        const token = await getAccessToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
        return request;
      },
    };
    client.use(auth);
  }

  if (getLocale) {
    const locale: Middleware = {
      onRequest({ request }) {
        const lang = getLocale();
        if (lang) {
          request.headers.set("Accept-Language", lang);
        }
        return request;
      },
    };
    client.use(locale);
  }

  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

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
 * a `NetworkError` (failed fetch, see api-client) becomes NETWORK_ERROR; anything else unrecognised is INTERNAL_ERROR, so code bugs are never shown as connectivity problems. Texts for both are left empty so the UI uses `errors.<code>` messages.
 */
export function toApiProblem(error: unknown, status?: number): ApiProblem {
  if (error instanceof ApiProblemError) return error.problem;
  if (error instanceof NetworkError) return fallback("NETWORK_ERROR", 0);
  if (isProblem(error)) return error;
  return fallback("INTERNAL_ERROR", status ?? 500);
}

/** Returns `data` of an openapi-fetch result or throws an `ApiProblemError`. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiProblemError(toApiProblem(result.error, result.response.status));
  }
  // A successful no-body response (e.g. 204) legitimately has no data.
  return result.data as T;
}
