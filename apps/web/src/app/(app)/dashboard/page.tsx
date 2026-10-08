import { navMetadata } from "@/lib/nav-metadata";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";

export default async function Page({ searchParams }: PageProps<"/dashboard">) {
  const { venue } = await searchParams;
  return <DashboardScreen venueId={typeof venue === "string" ? venue : undefined} />;
}

export const generateMetadata = () => navMetadata("dashboard");
