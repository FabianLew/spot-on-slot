import { afterEach, describe, expect, it, vi } from "vitest";
import { Umami } from "./umami";

afterEach(() => vi.unstubAllEnvs());

describe("Umami", () => {
  it("renders nothing without a website id", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "");
    expect(Umami()).toBeNull();
  });

  it("loads the cloud script with the website id by default", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "abc-123");
    vi.stubEnv("NEXT_PUBLIC_UMAMI_SCRIPT_URL", "");
    expect(Umami()?.props).toMatchObject({
      src: "https://cloud.umami.is/script.js",
      "data-website-id": "abc-123",
      strategy: "afterInteractive",
    });
  });

  it("uses a self-hosted script address when set", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "abc-123");
    vi.stubEnv("NEXT_PUBLIC_UMAMI_SCRIPT_URL", "https://stats.example.com/script.js");
    expect(Umami()?.props.src).toBe("https://stats.example.com/script.js");
  });
});
