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

describe("createApiClient session handling", () => {
  function sessionSetup(responses: Array<() => Response>) {
    const seen: Request[] = [];
    const fetchMock = vi.fn(async (request: Request) => {
      seen.push(request);
      const next = responses.shift();
      return next ? next() : Response.json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    let token: string | null = "old";
    const onUnauthorized = vi.fn(async () => {
      token = "new";
      return true;
    });
    const client = createApiClient({ baseUrl: "http://api.test", getAccessToken: () => token, onUnauthorized });
    return { client, seen, onUnauthorized, fetchMock };
  }

  it("sends the bearer token", async () => {
    const { client, seen } = sessionSetup([]);
    await client.GET("/api/v1/me");
    expect(seen[0]!.headers.get("Authorization")).toBe("Bearer old");
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    const { client, seen, onUnauthorized } = sessionSetup([
      () => new Response(null, { status: 401 }),
      () => Response.json({ id: "1" }),
    ]);
    const result = await client.GET("/api/v1/me");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result.response.status).toBe(200);
    expect(seen[1]!.headers.get("Authorization")).toBe("Bearer new");
  });

  it("retries a request with a body", async () => {
    const { client, seen } = sessionSetup([() => new Response(null, { status: 401 }), () => Response.json({})]);
    await client.POST("/api/v1/waitlist" as never, { body: { email: "a@b.pl" } } as never);
    expect(await seen[1]!.text()).toBe(JSON.stringify({ email: "a@b.pl" }));
  });

  it("returns the 401 when the refresh fails", async () => {
    const { client, onUnauthorized } = sessionSetup([() => new Response(null, { status: 401 })]);
    onUnauthorized.mockResolvedValueOnce(false);
    const result = await client.GET("/api/v1/me");
    expect(result.response.status).toBe(401);
  });

  it("shares one refresh between parallel requests", async () => {
    const { client, onUnauthorized } = sessionSetup([
      () => new Response(null, { status: 401 }),
      () => new Response(null, { status: 401 }),
    ]);
    let release: (ok: boolean) => void = () => {};
    onUnauthorized.mockImplementationOnce(() => new Promise<boolean>((resolve) => (release = resolve)));
    const both = Promise.all([client.GET("/api/v1/me"), client.GET("/api/v1/me")]);
    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
    release(true);
    await both;
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("sends auth calls with credentials and without the bearer token, never refreshing them", async () => {
    const { client, seen, onUnauthorized } = sessionSetup([() => new Response(null, { status: 401 })]);
    const result = await client.POST("/api/v1/auth/refresh");
    expect(result.response.status).toBe(401);
    expect(seen[0]!.credentials).toBe("include");
    expect(seen[0]!.headers.has("Authorization")).toBe(false);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
