import { createApiClient } from "@spot-on-slot/api-client";

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  getLocale: () => (typeof document !== "undefined" ? document.documentElement.lang || undefined : undefined),
});
