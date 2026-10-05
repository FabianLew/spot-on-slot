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
    field: "#ffffff",
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
    field: "#0a0a0a",
  },
} as const;

export type Palette = { [K in keyof typeof colors.light]: string };

/**
 * "Arcade" palettes for the web app, measured from the first design mockups
 * (black/gray + yellow + red, square corners). Red is adjusted for WCAG AA:
 * light #d91f17 carries white text (5.1:1), dark #ff261f carries near-black text (5.4:1).
 * The landing still uses `colors`; keep src/arcade.css in sync (tokens.test.ts).
 */
export const arcadeColors = {
  light: {
    background: "#d7d7d2",
    foreground: "#101010",
    card: "#eeeeea",
    cardForeground: "#101010",
    popover: "#eeeeea",
    popoverForeground: "#101010",
    primary: "#d91f17",
    primaryForeground: "#ffffff",
    secondary: "#fcfcf8",
    secondaryForeground: "#101010",
    muted: "#e2e2dd",
    mutedForeground: "#4a4a47",
    accent: "#e2e2dd",
    accentForeground: "#101010",
    border: "#101010",
    input: "#101010",
    ring: "#d91f17",
    success: "#15803d",
    danger: "#b91c1c",
    dangerForeground: "#ffffff",
    highlight: "#ffe31a",
    highlightForeground: "#101010",
    heading: "#101010",
    field: "#fcfcf8",
    grid: "#c8c8c3",
  },
  dark: {
    background: "#050505",
    foreground: "#f2f2ee",
    card: "#0d0d0d",
    cardForeground: "#f2f2ee",
    popover: "#0d0d0d",
    popoverForeground: "#f2f2ee",
    primary: "#ff261f",
    primaryForeground: "#050505",
    secondary: "#141414",
    secondaryForeground: "#f2f2ee",
    muted: "#141414",
    mutedForeground: "#a3a39e",
    accent: "#1f1b05",
    accentForeground: "#ffd400",
    border: "#ffd400",
    input: "#ffd400",
    ring: "#ff261f",
    success: "#22c55e",
    danger: "#f87171",
    dangerForeground: "#050505",
    highlight: "#ffd400",
    highlightForeground: "#050505",
    heading: "#ffd400",
    field: "#050505",
    grid: "#2b260c",
  },
} as const;

export type ArcadePalette = { [K in keyof typeof arcadeColors.light]: string };

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

export const arcadeTypography = {
  fontFamily: {
    display: "Silkscreen",
    sans: "Space Mono",
  },
} as const;

export const tokens = { colors, radius, spacing, typography } as const;
export type Tokens = typeof tokens;
