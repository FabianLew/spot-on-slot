import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arcadeColors, colors } from "./index";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Body of the first top-level block whose selector is exactly `selector`. */
function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.:]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`block ${selector} not found`);
  return match[1] ?? "";
}

function declared(body: string, key: string): string | undefined {
  return new RegExp(`--${kebab(key)}:\\s*([^;]+);`, "i").exec(body)?.[1]?.trim();
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const files = [
  { name: "theme.css", palettes: colors },
  { name: "arcade.css", palettes: arcadeColors },
] as const;

describe.each(files)("$name", ({ name, palettes }) => {
  const css = read(`./${name}`);

  it("light and dark palettes have the same keys", () => {
    expect(Object.keys(palettes.dark).sort()).toEqual(Object.keys(palettes.light).sort());
  });

  it("defines every light token in :root", () => {
    const body = block(css, ":root");
    for (const [key, value] of Object.entries(palettes.light)) {
      expect(declared(body, key)?.toLowerCase(), key).toBe(value.toLowerCase());
    }
  });

  it("defines every dark token in .dark", () => {
    const body = block(css, ".dark");
    for (const [key, value] of Object.entries(palettes.dark)) {
      expect(declared(body, key)?.toLowerCase(), key).toBe(value.toLowerCase());
    }
  });
});

describe("design tokens", () => {
  it("theme.css maps every token to a Tailwind color", () => {
    const css = read("./theme.css");
    for (const key of Object.keys(colors.light)) {
      expect(css).toContain(`--color-${kebab(key)}: var(--${kebab(key)});`);
    }
  });

  it("arcade.css maps its extra tokens to Tailwind colors", () => {
    const css = read("./arcade.css");
    for (const key of Object.keys(arcadeColors.light).filter((k) => !(k in colors.light))) {
      expect(css).toContain(`--color-${kebab(key)}: var(--${kebab(key)});`);
    }
  });

  it("arcade palette extends the base palette", () => {
    for (const key of Object.keys(colors.light)) expect(arcadeColors.light).toHaveProperty(key);
  });

  it("primary is #dc2626 in both base themes", () => {
    expect(colors.light.primary).toBe("#dc2626");
    expect(colors.dark.primary).toBe("#dc2626");
  });

  it.each(["light", "dark"] as const)("arcade %s text pairs meet WCAG AA (4.5:1)", (mode) => {
    const p = arcadeColors[mode];
    const pairs: [string, string, string][] = [
      ["foreground/background", p.foreground, p.background],
      ["foreground/card", p.cardForeground, p.card],
      ["muted text/card", p.mutedForeground, p.card],
      ["muted text/muted", p.mutedForeground, p.muted],
      ["heading/card", p.heading, p.card],
      ["primary text", p.primaryForeground, p.primary],
      ["highlight text", p.highlightForeground, p.highlight],
      ["field text", p.foreground, p.field],
      ["accent text", p.accentForeground, p.accent],
      ["danger text", p.dangerForeground, p.danger],
    ];
    for (const [label, fg, bg] of pairs) {
      expect(contrast(fg, bg), `${label} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
