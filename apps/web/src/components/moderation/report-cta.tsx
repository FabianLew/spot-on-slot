"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants, cn } from "@spot-on-slot/ui";
import { useSession } from "@/components/session/session-provider";
import { ReportDialog, type ReportTarget } from "./report-dialog";

/**
 * "Zgłoś" on a public profile, venue or listing. Signed-in users open the form; visitors sign in first and come
 * back to the page.
 */
export function ReportCta({ target, className }: { target: ReportTarget; className?: string }) {
  const t = useTranslations("report");
  const { session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const classes = cn("h-auto min-h-10 w-full py-2 text-muted-foreground sm:w-auto", className);

  if (session.status === "loading" || session.status === "error") return null;
  if (session.status === "anonymous") {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={cn(buttonVariants({ variant: "ghost" }), classes)}>
        <Flag className="size-4" aria-hidden="true" />
        {t("cta")}
      </Link>
    );
  }
  return (
    <>
      <Button type="button" variant="ghost" className={classes} onClick={() => setOpen(true)}>
        <Flag className="size-4" aria-hidden="true" />
        {t("cta")}
      </Button>
      <ReportDialog target={target} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
