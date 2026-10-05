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
import type { NavIconName } from "./nav-items";

export const navIcons: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  calendar: CalendarDays,
  search: Search,
  messages: MessageCircle,
  listings: Megaphone,
  bookings: Handshake,
  profile: UserRound,
  settings: Settings,
};
