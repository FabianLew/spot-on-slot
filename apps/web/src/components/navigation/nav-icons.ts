import type { ComponentType, SVGProps } from "react";
import { Calendar } from "pixelarticons/react/Calendar";
import { Clock } from "pixelarticons/react/Clock";
import { Flag } from "pixelarticons/react/Flag";
import { LayoutGlyph } from "pixelarticons/react/LayoutGlyph";
import { Megaphone } from "pixelarticons/react/Megaphone";
import { Message } from "pixelarticons/react/Message";
import { Notes } from "pixelarticons/react/Notes";
import { Search } from "pixelarticons/react/Search";
import { SettingsCog } from "pixelarticons/react/SettingsCog";
import { Shield } from "pixelarticons/react/Shield";
import { User } from "pixelarticons/react/User";
import { Users } from "pixelarticons/react/Users";
import type { NavIconName } from "./nav-items";

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export const navIcons: Record<NavIconName, NavIcon> = {
  dashboard: LayoutGlyph,
  calendar: Calendar,
  search: Search,
  messages: Message,
  listings: Megaphone,
  bookings: Notes,
  profile: User,
  settings: SettingsCog,
  reports: Flag,
  users: Users,
  history: Clock,
  admins: Shield,
};
