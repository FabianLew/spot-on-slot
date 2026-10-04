import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema";

export type { components, paths };
export type ApiSchemas = components["schemas"];

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
}

/**
 * Typed client generated from the backend OpenAPI spec.
 * Shared by the web app and, later, the Expo mobile app.
 */
export function createApiClient({ baseUrl, getAccessToken }: ApiClientOptions) {
  const client = createClient<paths>({ baseUrl });

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

  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
