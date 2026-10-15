import { isAccountRole, isAccountState } from "@/components/admin/admin-home";
import { UsersScreen } from "@/components/admin/users-screen";
import { navMetadata } from "@/lib/nav-metadata";

export default async function Page({ searchParams }: PageProps<"/admin/users">) {
  const { q, role, state } = await searchParams;
  return (
    <UsersScreen
      filter={{
        q: typeof q === "string" ? q : undefined,
        role: typeof role === "string" && isAccountRole(role) ? role : undefined,
        state: typeof state === "string" && isAccountState(state) ? state : undefined,
      }}
    />
  );
}

export const generateMetadata = () => navMetadata("adminUsers");
