/**
 * Design tokens shared by web, landing and (later) the Expo app.
 * Temporary black/gray/red palettes (light and dark) until the brand book defines
 * the palette and typography; keep src/theme.css in sync when these change
 * (tokens.test.ts fails on drift).
 */
export const colors = {
  light: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#ffffff",
    cardForeground: "#0a0a0a",
    popover: "#ffffff",
    popoverForeground: "#0a0a0a",
    primary: "#dc2626",
    primaryForeground: "#ffffff",
    secondary: "#f4f4f5",
    secondaryForeground: "#18181b",
    muted: "#f4f4f5",
    mutedForeground: "#52525b",
    accent: "#f4f4f5",
    accentForeground: "#18181b",
    border: "#e4e4e7",
    input: "#e4e4e7",
    ring: "#dc2626",
    success: "#15803d",
    danger: "#b91c1c",
    dangerForeground: "#ffffff",
  },
  dark: {
    background: "#0a0a0a",
    foreground: "#fafafa",
    card: "#171717",
    cardForeground: "#fafafa",
    popover: "#171717",
    popoverForeground: "#fafafa",
    primary: "#dc2626",
    primaryForeground: "#ffffff",
    secondary: "#27272a",
    secondaryForeground: "#fafafa",
    muted: "#171717",
    mutedForeground: "#a1a1aa",
    accent: "#27272a",
    accentForeground: "#fafafa",
    border: "#27272a",
    input: "#27272a",
    ring: "#dc2626",
    success: "#22c55e",
    danger: "#f87171",
    dangerForeground: "#0a0a0a",
  },
} as const;

export type Palette = { [K in keyof typeof colors.light]: string };

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;

export const typography = {
  fontFamily: {
    sans: "Inter",
  },
  fontSize: {
    sm: 14,
    base: 16,
    lg: 18,
    xl: 22,
    "2xl": 28,
    "3xl": 36,
  },
} as const;

export const tokens = { colors, radius, spacing, typography } as const;
export type Tokens = typeof tokens;
