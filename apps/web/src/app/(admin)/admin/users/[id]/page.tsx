import { UserScreen } from "@/components/admin/user-screen";
import { navMetadata } from "@/lib/nav-metadata";

export default async function Page({ params }: PageProps<"/admin/users/[id]">) {
  return <UserScreen userId={(await params).id} />;
}

export const generateMetadata = () => navMetadata("adminUsers");
