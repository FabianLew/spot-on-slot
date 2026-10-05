import { describe, expect, it, vi } from "vitest";
import { createApiClient, NetworkError } from "./index";

function setup(getLocale?: () => string | undefined) {
  const fetchMock = vi.fn(async (_request: Request) => Response.json([]));
  vi.stubGlobal("fetch", fetchMock);
  const client = createApiClient({ baseUrl: "http://api.test", getLocale });
  return { client, fetchMock };
}

describe("createApiClient locale middleware", () => {
  it("sends Accept-Language when getLocale returns a locale", async () => {
    const { client, fetchMock } = setup(() => "en");
    await client.GET("/api/v1/health" as never);
    expect(fetchMock.mock.calls[0]![0].headers.get("Accept-Language")).toBe("en");
  });

  it("sends no Accept-Language when getLocale returns undefined", async () => {
    const { client, fetchMock } = setup(() => undefined);
    await client.GET("/api/v1/health" as never);
    expect(fetchMock.mock.calls[0]![0].headers.has("Accept-Language")).toBe(false);
  });

  it("sends no Accept-Language when getLocale is not provided", async () => {
    const { client, fetchMock } = setup();
    await client.GET("/api/v1/health" as never);
    expect(fetchMock.mock.calls[0]![0].headers.has("Accept-Language")).toBe(false);
  });
});

describe("createApiClient network errors", () => {
  it("turns a failed fetch into a NetworkError with status 0", async () => {
    const cause = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(cause)));
    const client = createApiClient({ baseUrl: "http://api.test" });
    const error = await client.GET("/api/v1/health" as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR", status: 0, cause });
  });

  it("does not wrap HTTP error responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "X", status: 404 }, { status: 404 })));
    const client = createApiClient({ baseUrl: "http://api.test" });
    const result = await client.GET("/api/v1/health" as never);
    expect(result.response.status).toBe(404);
  });
});
