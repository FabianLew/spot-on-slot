/**
 * Design tokens shared by web, landing and (later) the Expo app.
 * Placeholder values until the brand book defines the palette and typography;
 * keep src/theme.css in sync when these change.
 */
export const colors = {
  primary: "#5b3df5",
  primaryForeground: "#ffffff",
  secondary: "#ff7a59",
  secondaryForeground: "#1a1033",
  background: "#ffffff",
  foreground: "#14111f",
  muted: "#f4f2fa",
  mutedForeground: "#6b6680",
  border: "#e4e0f0",
  success: "#1f9d55",
  danger: "#d93a3a",
} as const;

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
