import type messages from "../../../messages/pl.json";

export type NavIconName =
  | "dashboard"
  | "calendar"
  | "search"
  | "messages"
  | "listings"
  | "bookings"
  | "profile"
  | "settings";

export type NavKey = Exclude<keyof typeof messages.nav, "more" | "primary" | "skipToContent" | "menu">;

// Plain serializable data: it crosses the server -> client boundary (icons are resolved in nav-icons.ts).
// next.config has no typedRoutes, so hrefs are plain strings (no `Route` type available).
export type NavItem = {
  href: string;
  labelKey: NavKey;
  icon: NavIconName;
  mobile: "tab" | "more";
};

export const navItems: readonly NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: "dashboard", mobile: "tab" },
  { href: "/calendar", labelKey: "calendar", icon: "calendar", mobile: "tab" },
  { href: "/search", labelKey: "search", icon: "search", mobile: "tab" },
  { href: "/messages", labelKey: "messages", icon: "messages", mobile: "tab" },
  { href: "/listings", labelKey: "listings", icon: "listings", mobile: "more" },
  { href: "/bookings", labelKey: "bookings", icon: "bookings", mobile: "more" },
  { href: "/profile", labelKey: "profile", icon: "profile", mobile: "more" },
  { href: "/settings", labelKey: "settings", icon: "settings", mobile: "more" },
];
