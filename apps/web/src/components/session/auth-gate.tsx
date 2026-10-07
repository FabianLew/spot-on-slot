"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useSession } from "./session-provider";

/** Shows app pages only to signed-in users; everyone else goes to the login page and back afterwards. */
export function AuthGate({ children }: { children: ReactNode }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const { session, retry } = useSession();

  useEffect(() => {
    if (session.status !== "anonymous") return;
    if (session.redirectTo) {
      router.replace(session.redirectTo);
      return;
    }
    const next = window.location.pathname + window.location.search;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [session, router]);

  if (session.status === "authenticated") return children;
  if (session.status === "error") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <ApiErrorState error={session.problem} onRetry={retry} />
      </main>
    );
  }
  return (
    <main className="pattern-grid flex flex-1 items-center justify-center p-6" aria-busy="true">
      <p role="status" className="font-display text-lg">
        {t("loading")}
      </p>
    </main>
  );
}

/** Keeps `next` on this site, so a crafted login link cannot send people elsewhere. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}
