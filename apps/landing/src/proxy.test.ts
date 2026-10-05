// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import proxy from "./proxy";

function get(path: string, acceptLanguage?: string) {
  const headers = acceptLanguage ? { "accept-language": acceptLanguage } : undefined;
  return proxy(new NextRequest(new URL(path, "http://localhost:3001"), { headers }));
}

describe("proxy", () => {
  it("redirects / to /en for an English browser", () => {
    const response = get("/", "en-US,en;q=0.9");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3001/en");
  });

  it("redirects / to /pl for an unsupported language", () => {
    const response = get("/", "de");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3001/pl");
  });

  it("redirects / to /pl without an Accept-Language header", () => {
    const response = get("/");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3001/pl");
  });

  it("does not redirect an unknown locale, so the [locale] layout answers 404", () => {
    const response = get("/de", "en");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes prefixed paths through", () => {
    expect(get("/en", "pl").headers.get("location")).toBeNull();
  });
});
