import { navMetadata } from "@/lib/nav-metadata";
import { NewBookingScreen } from "@/components/bookings/new-booking-screen";

export default async function Page({ searchParams }: PageProps<"/bookings/new">) {
  const { artist, listing } = await searchParams;
  const source =
    typeof listing === "string" ? { listing } : typeof artist === "string" ? { artist } : null;
  return <NewBookingScreen source={source} />;
}

export const generateMetadata = () => navMetadata("bookings");
