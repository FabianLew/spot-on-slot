"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/components/session/session-provider";
import { ADMIN_HOME } from "./admin-home";

function Loading() {
  const t = useTranslations("auth");
  return (
    <div className="flex flex-1 items-center justify-center p-6" aria-busy="true">
      <p role="status" className="font-display text-lg">
        {t("loading")}
      </p>
    </div>
  );
}

/** The admin panel is for admin accounts only; anyone else goes to their dashboard. Runs inside `AuthGate`. */
export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session } = useSession();
  const admin = session.status === "authenticated" && session.user.role === "ADMIN";

  useEffect(() => {
    if (!admin) router.replace("/dashboard");
  }, [admin, router]);

  return admin ? children : <Loading />;
}

/** Admins have no profile, calendar or bookings: the app's pages send them to the panel. Runs inside `AuthGate`. */
export function AdminRedirect({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session } = useSession();
  const admin = session.status === "authenticated" && session.user.role === "ADMIN";

  useEffect(() => {
    if (admin) router.replace(ADMIN_HOME);
  }, [admin, router]);

  return admin ? <Loading /> : children;
}
