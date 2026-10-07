import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { absoluteUrl, pageAlternates, siteUrl } from "./site";

afterEach(() => vi.unstubAllEnvs());

describe("site addresses", () => {
  it("uses NEXT_PUBLIC_SITE_URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://spotonslot.pl/");
    expect(siteUrl()).toBe("https://spotonslot.pl");
    expect(absoluteUrl("/", "pl")).toBe("https://spotonslot.pl/pl");
  });

  it("translates the legal addresses per locale", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://spotonslot.pl");
    expect(absoluteUrl("/polityka-prywatnosci", "en")).toBe("https://spotonslot.pl/en/privacy-policy");
    expect(absoluteUrl("/regulamin", "en")).toBe("https://spotonslot.pl/en/terms");
  });

  it("gives a canonical address and hreflang alternates with x-default on Polish", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://spotonslot.pl");
    expect(pageAlternates("/regulamin", "en")).toEqual({
      canonical: "https://spotonslot.pl/en/terms",
      languages: {
        pl: "https://spotonslot.pl/pl/regulamin",
        en: "https://spotonslot.pl/en/terms",
        "x-default": "https://spotonslot.pl/pl/regulamin",
      },
    });
  });
});

describe("sitemap and robots", () => {
  it("lists the home page and both legal documents in both languages", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://spotonslot.pl");
    expect(sitemap().map((entry) => entry.url)).toEqual([
      "https://spotonslot.pl/pl",
      "https://spotonslot.pl/en",
      "https://spotonslot.pl/pl/polityka-prywatnosci",
      "https://spotonslot.pl/en/privacy-policy",
      "https://spotonslot.pl/pl/regulamin",
      "https://spotonslot.pl/en/terms",
    ]);
    expect(sitemap()[1].alternates?.languages).toMatchObject({ pl: "https://spotonslot.pl/pl" });
  });

  it("allows crawling except the waitlist confirmation and points to the sitemap", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://spotonslot.pl");
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/pl/waitlist/", "/en/waitlist/"] },
      sitemap: "https://spotonslot.pl/sitemap.xml",
    });
  });
});
