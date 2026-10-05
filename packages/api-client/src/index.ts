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
