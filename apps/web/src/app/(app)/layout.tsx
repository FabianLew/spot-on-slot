import type { ReactNode } from "react";
import { BottomTabs } from "@/components/navigation/bottom-tabs";
import { Sidebar } from "@/components/navigation/sidebar";
import { SkipLink } from "@/components/navigation/skip-link";
import { TopBar } from "@/components/navigation/top-bar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1">
      <SkipLink />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-10">
          {children}
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
