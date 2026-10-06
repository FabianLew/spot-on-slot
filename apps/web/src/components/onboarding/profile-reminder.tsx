"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, Panel, PixelSquare } from "@spot-on-slot/ui";
import { useSession } from "@/components/session/session-provider";
import { useProfileProgress } from "./queries";

/** The dashboard's "finish your profile" card, shown until the profile is published. */
export function ProfileReminder() {
  const t = useTranslations("onboarding.reminder");
  const { session } = useSession();
  const progress = useProfileProgress(session.status === "authenticated" ? session.user.role : "");
  if (progress.status !== "missing" && progress.status !== "draft") return null;

  const body =
    progress.status === "missing"
      ? t("empty")
      : progress.missing > 0
        ? t("body", { count: progress.missing })
        : t("draft");
  return (
    <Panel title={t("title")} className="border-primary">
      <p className="flex items-center gap-3 text-sm">
        <PixelSquare className="size-4 shrink-0 text-primary" />
        {body}
      </p>
      <Button asChild className="self-start">
        <Link href="/onboarding">{t("action")}</Link>
      </Button>
    </Panel>
  );
}
