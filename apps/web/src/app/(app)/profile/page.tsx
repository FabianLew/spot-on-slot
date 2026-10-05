import { navMetadata } from "@/lib/nav-metadata";
import { PlaceholderPage } from "@/components/page/placeholder-page";

export default function Page() {
  return <PlaceholderPage titleKey="profile" />;
}

export const generateMetadata = () => navMetadata("profile");
