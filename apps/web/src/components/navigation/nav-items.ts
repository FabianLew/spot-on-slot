import {
  CalendarDays,
  Handshake,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import type messages from "../../../messages/pl.json";

export type NavKey = Exclude<keyof typeof messages.nav, "more" | "primary" | "skipToContent" | "menu">;

// next.config has no typedRoutes, so hrefs are plain strings (no `Route` type available).
export type NavItem = {
  href: string;
  labelKey: NavKey;
  icon: LucideIcon;
  mobile: "tab" | "more";
};

export const navItems: readonly NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, mobile: "tab" },
  { href: "/calendar", labelKey: "calendar", icon: CalendarDays, mobile: "tab" },
  { href: "/search", labelKey: "search", icon: Search, mobile: "tab" },
  { href: "/messages", labelKey: "messages", icon: MessageCircle, mobile: "tab" },
  { href: "/listings", labelKey: "listings", icon: Megaphone, mobile: "more" },
  { href: "/bookings", labelKey: "bookings", icon: Handshake, mobile: "more" },
  { href: "/profile", labelKey: "profile", icon: UserRound, mobile: "more" },
  { href: "/settings", labelKey: "settings", icon: Settings, mobile: "more" },
];
