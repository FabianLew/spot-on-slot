import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/navigation/user-menu";
import { AuthGate } from "@/components/session/auth-gate";

/** The wizard is full screen: no sidebar, only the logo and the account menu (language, theme, sign-out). */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  return (
    <AuthGate>
      <main id="main" className="pattern-grid flex flex-1 justify-center px-4 py-8 sm:py-12">
        <div className="flex w-full max-w-2xl flex-col gap-10">
          <div className="flex items-start justify-between gap-6">
            <Logo label={t("appName")} className="[&>span:first-child]:text-3xl [&>span:last-child]:hidden" />
            <div className="w-36">
              <UserMenu side="bottom" />
            </div>
          </div>
          {children}
        </div>
      </main>
    </AuthGate>
  );
}
