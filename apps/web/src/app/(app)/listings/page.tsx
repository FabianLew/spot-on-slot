import { navMetadata } from "@/lib/nav-metadata";
import { ListingsScreen } from "@/components/listings/listings-screen";

export default async function Page({ searchParams }: PageProps<"/listings">) {
  const { venue, add } = await searchParams;
  return <ListingsScreen venueId={typeof venue === "string" ? venue : undefined} add={add === "1"} />;
}

export const generateMetadata = () => navMetadata("listings");
