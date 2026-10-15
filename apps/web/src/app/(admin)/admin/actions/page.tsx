import { HistoryScreen } from "@/components/admin/history-screen";
import { navMetadata } from "@/lib/nav-metadata";

export default function Page() {
  return <HistoryScreen />;
}

export const generateMetadata = () => navMetadata("adminHistory");
