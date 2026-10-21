import type messages from "../../../messages/pl.json";

export type NavIconName =
  | "dashboard"
  | "calendar"
  | "search"
  | "messages"
  | "listings"
  | "bookings"
  | "profile"
  | "settings"
  | "reports"
  | "users"
  | "history"
  | "admins";

export type NavKey = Exclude<keyof typeof messages.nav, "more" | "primary" | "skipToContent" | "menu">;

/** A counter shown next to the entry, resolved client-side in `nav-badges.ts`. */
export type NavBadgeName = "bookings" | "messages" | "reports";

// Plain serializable data: it crosses the server -> client boundary (icons are resolved in nav-icons.ts).
// next.config has no typedRoutes, so hrefs are plain strings (no `Route` type available).
export type NavItem = {
  href: string;
  labelKey: NavKey;
  icon: NavIconName;
  mobile: "tab" | "more";
  badge?: NavBadgeName;
};

export const navItems: readonly NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: "dashboard", mobile: "tab" },
  { href: "/calendar", labelKey: "calendar", icon: "calendar", mobile: "tab" },
  { href: "/search", labelKey: "search", icon: "search", mobile: "tab" },
  { href: "/messages", labelKey: "messages", icon: "messages", mobile: "tab", badge: "messages" },
  { href: "/listings", labelKey: "listings", icon: "listings", mobile: "more" },
  { href: "/bookings", labelKey: "bookings", icon: "bookings", mobile: "more", badge: "bookings" },
  { href: "/profile", labelKey: "profile", icon: "profile", mobile: "more" },
  { href: "/settings", labelKey: "settings", icon: "settings", mobile: "more" },
];

/** The admin panel's sections (the `(admin)` route group); admins see no other part of the app. */
export const adminNavItems: readonly NavItem[] = [
  { href: "/admin/reports", labelKey: "adminReports", icon: "reports", mobile: "tab", badge: "reports" },
  { href: "/admin/users", labelKey: "adminUsers", icon: "users", mobile: "tab" },
  { href: "/admin/actions", labelKey: "adminHistory", icon: "history", mobile: "tab" },
  { href: "/admin/admins", labelKey: "adminAdmins", icon: "admins", mobile: "more" },
  { href: "/admin/settings", labelKey: "settings", icon: "settings", mobile: "more" },
];
