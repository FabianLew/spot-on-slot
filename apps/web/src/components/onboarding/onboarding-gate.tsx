"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/components/session/session-provider";
import { useProfileProgress } from "./queries";
import { isOnboardingSkipped } from "./skip";

/**
 * Sends artists and venues without a profile to the wizard, unless they chose "later" in this browser. Runs
 * inside `AuthGate`, so the user is known.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const { session } = useSession();
  const user = session.status === "authenticated" ? session.user : null;
  const progress = useProfileProgress(user?.role ?? "");
  const redirect = user !== null && progress.status === "missing" && !isOnboardingSkipped(user.id);

  useEffect(() => {
    if (redirect) router.replace("/onboarding");
  }, [redirect, router]);

  if (progress.status === "loading" || redirect) {
    return (
      <div className="flex flex-1 items-center justify-center p-6" aria-busy="true">
        <p role="status" className="font-display text-lg">
          {t("loading")}
        </p>
      </div>
    );
  }
  return children;
}
