import type { ReactNode } from "react";
import { BottomTabs } from "@/components/navigation/bottom-tabs";
import { Sidebar } from "@/components/navigation/sidebar";
import { SkipLink } from "@/components/navigation/skip-link";
import { TopBar } from "@/components/navigation/top-bar";
import { AuthGate } from "@/components/session/auth-gate";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="flex min-h-dvh flex-1">
        <SkipLink />
        <Sidebar />
        <div className="pattern-grid flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-10 focus:outline-none"
          >
            {children}
          </main>
        </div>
        <BottomTabs />
      </div>
    </AuthGate>
  );
}
