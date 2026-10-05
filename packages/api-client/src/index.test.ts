import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./index";

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
