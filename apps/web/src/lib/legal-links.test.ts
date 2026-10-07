import { afterEach, describe, expect, it, vi } from "vitest";
import { getLegalLinks } from "./legal-links";

afterEach(() => vi.unstubAllEnvs());

describe("getLegalLinks", () => {
  it("uses the landing's Polish slugs by default", () => {
    vi.stubEnv("NEXT_PUBLIC_LANDING_URL", "");
    expect(getLegalLinks("pl")).toEqual({
      terms: "http://localhost:3001/pl/regulamin",
      privacy: "http://localhost:3001/pl/polityka-prywatnosci",
    });
  });

  it("uses the English slugs and the configured landing", () => {
    vi.stubEnv("NEXT_PUBLIC_LANDING_URL", "https://spotonslot.pl/");
    expect(getLegalLinks("en")).toEqual({
      terms: "https://spotonslot.pl/en/terms",
      privacy: "https://spotonslot.pl/en/privacy-policy",
    });
  });
});
