import { navMetadata } from "@/lib/nav-metadata";
import { CalendarScreen } from "@/components/calendar/calendar-screen";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function Page({ searchParams }: PageProps<"/calendar">) {
  const { day } = await searchParams;
  return <CalendarScreen day={typeof day === "string" && DAY.test(day) ? day : undefined} />;
}

export const generateMetadata = () => navMetadata("calendar");
