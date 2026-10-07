import { navMetadata } from "@/lib/nav-metadata";
import { BookingsScreen } from "@/components/bookings/bookings-screen";
import { isScope } from "@/components/bookings/scopes";

export default async function Page({ searchParams }: PageProps<"/bookings">) {
  const { scope, venue } = await searchParams;
  return (
    <BookingsScreen
      scope={isScope(scope) ? scope : undefined}
      venueId={typeof venue === "string" ? venue : undefined}
    />
  );
}

export const generateMetadata = () => navMetadata("bookings");
