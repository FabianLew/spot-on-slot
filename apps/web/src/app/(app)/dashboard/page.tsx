import { navMetadata } from "@/lib/nav-metadata";
import { ProfileReminder } from "@/components/onboarding/profile-reminder";
import { PlaceholderPage } from "@/components/page/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage titleKey="dashboard">
      <ProfileReminder />
    </PlaceholderPage>
  );
}

export const generateMetadata = () => navMetadata("dashboard");
