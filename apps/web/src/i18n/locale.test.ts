import { describe, expect, it } from "vitest";
import { resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("uses a supported cookie", () => {
    expect(resolveLocale({ cookie: "en" })).toBe("en");
  });
  it("ignores an unsupported cookie and falls back to pl", () => {
    expect(resolveLocale({ cookie: "de" })).toBe("pl");
  });
  it("uses Accept-Language when there is no cookie", () => {
    expect(resolveLocale({ acceptLanguage: "en-US,en;q=0.9" })).toBe("en");
  });
  it("honours q-values and skips unsupported languages", () => {
    expect(resolveLocale({ acceptLanguage: "fr;q=1, en;q=0.5" })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "en;q=0.4, pl;q=0.8" })).toBe("pl");
  });
  it("falls back to pl for wildcard or nothing", () => {
    expect(resolveLocale({ acceptLanguage: "*" })).toBe("pl");
    expect(resolveLocale({})).toBe("pl");
  });
  it("prefers the cookie over the header", () => {
    expect(resolveLocale({ cookie: "pl", acceptLanguage: "en" })).toBe("pl");
  });
});
