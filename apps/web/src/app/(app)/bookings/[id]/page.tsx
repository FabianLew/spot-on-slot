import { navMetadata } from "@/lib/nav-metadata";
import { BookingDetail } from "@/components/bookings/booking-detail";

export default async function Page({ params }: PageProps<"/bookings/[id]">) {
  return <BookingDetail id={(await params).id} />;
}

export const generateMetadata = () => navMetadata("bookings");
