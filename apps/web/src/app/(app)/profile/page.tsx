import { navMetadata } from "@/lib/nav-metadata";
import { MyProfile } from "@/components/artist/my-profile";

export default function Page() {
  return <MyProfile />;
}

export const generateMetadata = () => navMetadata("profile");
