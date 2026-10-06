import { navMetadata } from "@/lib/nav-metadata";
import { MyProfile } from "@/components/artist/my-profile";

export default async function Page({ searchParams }: PageProps<"/profile">) {
  const { venue } = await searchParams;
  return <MyProfile venueId={typeof venue === "string" ? venue : undefined} />;
}

export const generateMetadata = () => navMetadata("profile");
