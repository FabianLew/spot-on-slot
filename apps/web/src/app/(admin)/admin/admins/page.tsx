import { AdminsScreen } from "@/components/admin/admins-screen";
import { navMetadata } from "@/lib/nav-metadata";

export default function Page() {
  return <AdminsScreen />;
}

export const generateMetadata = () => navMetadata("adminAdmins");
