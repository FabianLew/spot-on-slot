import { navMetadata } from "@/lib/nav-metadata";
import { CalendarScreen } from "@/components/calendar/calendar-screen";

export default function Page() {
  return <CalendarScreen />;
}

export const generateMetadata = () => navMetadata("calendar");
