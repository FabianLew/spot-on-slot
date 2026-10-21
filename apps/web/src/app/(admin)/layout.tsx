import type { ReactNode } from "react";
import { AccountGate } from "@/components/account/account-gate";
import { AdminGate } from "@/components/admin/admin-gate";
import { BottomTabs } from "@/components/navigation/bottom-tabs";
import { adminNavItems } from "@/components/navigation/nav-items";
import { Sidebar } from "@/components/navigation/sidebar";
import { SkipLink } from "@/components/navigation/skip-link";
import { TopBar } from "@/components/navigation/top-bar";
import { AuthGate } from "@/components/session/auth-gate";

/** The admin panel: the same frame as the app, with the panel's own sections and no notifications. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <AccountGate>
        <AdminGate>
          <div className="flex min-h-dvh flex-1">
            <SkipLink />
            <Sidebar items={adminNavItems} bell={false} />
            <div className="pattern-grid flex min-w-0 flex-1 flex-col">
              <TopBar items={adminNavItems} bell={false} />
              <main
                id="main"
                tabIndex={-1}
                className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-10 focus:outline-none"
              >
                {children}
              </main>
            </div>
            <BottomTabs items={adminNavItems} />
          </div>
        </AdminGate>
      </AccountGate>
    </AuthGate>
  );
}
