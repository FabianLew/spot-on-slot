import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrivacyConfig } from "./privacy-config";

describe("getPrivacyConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads the data controller from the environment", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_CONTROLLER", "Spot On Slot sp. z o.o.");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_EMAIL", "privacy@example.com");
    expect(getPrivacyConfig()).toEqual({
      controller: "Spot On Slot sp. z o.o.",
      email: "privacy@example.com",
      isPlaceholder: false,
    });
  });

  it("falls back to visible placeholders when both values are missing", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_CONTROLLER", "");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_EMAIL", "");
    expect(getPrivacyConfig()).toEqual({
      controller: "[administrator danych]",
      email: "[e-mail kontaktowy]",
      isPlaceholder: true,
    });
  });

  it("marks the config as placeholder when only one value is set", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_CONTROLLER", "Spot On Slot sp. z o.o.");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_EMAIL", "");
    expect(getPrivacyConfig()).toEqual({
      controller: "Spot On Slot sp. z o.o.",
      email: "[e-mail kontaktowy]",
      isPlaceholder: true,
    });
  });
});
