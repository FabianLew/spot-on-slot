"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Button,
  buttonVariants,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Panel,
  toast,
} from "@spot-on-slot/ui";
import { authLinkClass } from "@/components/auth/auth-card";
import { Logo } from "@/components/brand/logo";
import { useSession, type SessionUser } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { getLegalLinks } from "@/lib/legal-links";
import { problemMessage } from "@/lib/problem-text";
import { useDeletionDate } from "./deletion-date";

/** Where an account that has not accepted the current terms may still go. */
export const TERMS_EXEMPT_PATH = "/settings";

/**
 * Runs inside `AuthGate`. An account waiting for deletion sees only the restore screen (the rest of the API answers
 * 403 then, so nothing below mounts); an account behind on the terms gets a blocking dialog, except in Settings,
 * which shows `TermsNotice` instead.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const pathname = usePathname();
  if (session.status !== "authenticated") return children;
  const user = session.user;
  if (user.deletionScheduledAt != null) return <DeletionPending scheduledAt={user.deletionScheduledAt} />;
  if (!user.termsAccepted) {
    // Settings shows `TermsNotice` in the page itself.
    return pathname === TERMS_EXEMPT_PATH ? (
      children
    ) : (
      <>
        {children}
        <TermsDialog user={user} />
      </>
    );
  }
  return children;
}

function DeletionPending({ scheduledAt }: { scheduledAt: string }) {
  const t = useTranslations();
  const { signOut, reloadUser } = useSession();
  const date = useDeletionDate();
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    try {
      unwrap(await api.POST("/api/v1/me/deletion/cancel"));
      await reloadUser();
      toast.success(t("account.pending.restored"));
    } catch (failure) {
      toast.error(problemMessage(t, failure));
      setBusy(false);
    }
  }

  return (
    <main id="main" className="pattern-grid flex flex-1 items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Logo label={t("common.appName")} className="[&>span:first-child]:text-3xl [&>span:last-child]:hidden" />
        <span aria-hidden="true" className="pattern-checker h-3 text-heading dark:text-primary" />
        <Panel className="gap-6 p-6">
          <h1 className="font-display text-2xl leading-tight text-heading">
            {t("account.pending.title", { date: date(scheduledAt) })}
          </h1>
          <p className="text-sm leading-relaxed">{t("account.pending.text")}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={restore} disabled={busy}>
              {busy ? t("account.pending.restoring") : t("account.pending.restore")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void signOut()} disabled={busy}>
              {t("account.pending.signOut")}
            </Button>
          </div>
        </Panel>
      </div>
    </main>
  );
}

function useAcceptTerms() {
  const t = useTranslations();
  const { reloadUser } = useSession();
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    try {
      unwrap(await api.POST("/api/v1/me/terms"));
      await reloadUser();
    } catch (failure) {
      toast.error(problemMessage(t, failure));
      setBusy(false);
    }
  }
  return { busy, accept };
}

function TermsText() {
  const t = useTranslations("account.terms");
  const legal = getLegalLinks(useLocale());
  const link = (href: string) =>
    function LegalLink(chunks: ReactNode) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={authLinkClass}>
          {chunks}
        </a>
      );
    };
  return t.rich("text", { terms: link(legal.terms), privacy: link(legal.privacy) });
}

function TermsDialog({ user }: { user: SessionUser }) {
  const t = useTranslations();
  const { signOut } = useSession();
  const { busy, accept } = useAcceptTerms();
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        closeLabel={t("common.close")}
        data-terms-version={user.termsVersion}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        // Accepting is the only way on, so the close button is hidden.
        className="rounded-none border-2 border-border [&>button:last-child]:hidden"
      >
        <DialogHeader>
          <DialogTitle className="uppercase">{t("account.terms.title")}</DialogTitle>
          <DialogDescription className="leading-relaxed text-foreground">
            <TermsText />
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={accept} disabled={busy}>
            {busy ? t("account.terms.accepting") : t("account.terms.accept")}
          </Button>
          <Link href={TERMS_EXEMPT_PATH} className={buttonVariants({ variant: "outline" })}>
            {t("account.terms.settings")}
          </Link>
          <Button type="button" variant="ghost" onClick={() => void signOut()}>
            {t("account.terms.signOut")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The terms prompt inside Settings, where the blocking dialog would hide the page; nothing once accepted. */
export function TermsNotice() {
  const t = useTranslations("account.terms");
  const { session } = useSession();
  const { busy, accept } = useAcceptTerms();
  if (session.status !== "authenticated" || session.user.termsAccepted) return null;
  return (
    <section
      aria-labelledby="terms-notice-title"
      data-terms-version={session.user.termsVersion}
      className="flex flex-col gap-3 border-2 border-border bg-highlight p-4 text-sm text-highlight-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <h2 id="terms-notice-title" className="font-display text-base leading-none">
          {t("title")}
        </h2>
        <p>
          <TermsText />
        </p>
      </div>
      <Button type="button" className="self-start sm:self-center" onClick={accept} disabled={busy}>
        {busy ? t("accepting") : t("accept")}
      </Button>
    </section>
  );
}
