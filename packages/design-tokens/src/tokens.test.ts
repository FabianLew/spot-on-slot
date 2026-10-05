import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colors } from "./index";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Body of the first top-level block whose selector is exactly `selector`. */
function block(selector: string): string {
  const escaped = selector.replace(/[.:]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`block ${selector} not found in theme.css`);
  return match[1] ?? "";
}

function declared(body: string, key: string): string | undefined {
  return new RegExp(`--${kebab(key)}:\\s*([^;]+);`, "i").exec(body)?.[1]?.trim();
}

describe("design tokens", () => {
  it("light and dark palettes have the same keys", () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it("theme.css defines every light token in :root", () => {
    const body = block(":root");
    for (const [key, value] of Object.entries(colors.light)) {
      expect(declared(body, key)?.toLowerCase(), key).toBe(value.toLowerCase());
    }
  });

  it("theme.css defines every dark token in .dark", () => {
    const body = block(".dark");
    for (const [key, value] of Object.entries(colors.dark)) {
      expect(declared(body, key)?.toLowerCase(), key).toBe(value.toLowerCase());
    }
  });

  it("theme.css maps every token to a Tailwind color", () => {
    for (const key of Object.keys(colors.light)) {
      expect(css).toContain(`--color-${kebab(key)}: var(--${kebab(key)});`);
    }
  });

  it("primary is #dc2626 in both themes", () => {
    expect(colors.light.primary).toBe("#dc2626");
    expect(colors.dark.primary).toBe("#dc2626");
  });
});
