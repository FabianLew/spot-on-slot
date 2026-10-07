"use client";

import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@spot-on-slot/ui";
import { AuthCard, AuthNotice } from "@/components/auth/auth-card";
import { useSession } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { problemMessage } from "@/lib/problem-text";

type State = { step: "pending" } | { step: "done" } | { step: "failed"; message: string };

/** Confirms the new address from the e-mail link as soon as the page opens; works signed in and signed out. */
export function ConfirmEmailChange({ token }: { token?: string }) {
  const t = useTranslations();
  const { session, reloadUser } = useSession();
  const [state, setState] = useState<State>(
    token ? { step: "pending" } : { step: "failed", message: t("account.confirmEmail.invalid") },
  );
  // The token works once; React's dev double effect must not spend it twice.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    (async () => {
      try {
        unwrap(await api.POST("/api/v1/auth/email-change/confirm", { body: { token } }));
        setState({ step: "done" });
      } catch (failure) {
        const code = toApiProblem(failure).code;
        const message =
          code === "IDENTITY_TOKEN_INVALID"
            ? t("account.confirmEmail.invalid")
            : code === "IDENTITY_EMAIL_TAKEN"
              ? t("account.confirmEmail.taken")
              : problemMessage(t, failure);
        setState({ step: "failed", message });
      }
    })();
  }, [token, t]);

  const signedIn = session.status === "authenticated";
  // A signed-in tab still holds the old address.
  useEffect(() => {
    if (state.step === "done" && signedIn) void reloadUser().catch(() => undefined);
  }, [state.step, signedIn, reloadUser]);

  return (
    <AuthCard title={t("account.confirmEmail.title")}>
      {state.step === "pending" && (
        <p role="status" aria-busy="true" className="text-sm">
          {t("account.confirmEmail.pending")}
        </p>
      )}
      {state.step === "done" && (
        <>
          <AuthNotice>
            {signedIn ? t("account.confirmEmail.successSignedIn") : t("account.confirmEmail.success")}
          </AuthNotice>
          <Link href={signedIn ? "/settings" : "/login"} className={buttonVariants()}>
            {signedIn ? t("account.confirmEmail.toSettings") : t("account.confirmEmail.login")}
          </Link>
        </>
      )}
      {state.step === "failed" && (
        <>
          <p role="alert" className="flex items-start gap-2 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.message}
          </p>
          <Link href={signedIn ? "/settings" : "/login"} className={buttonVariants({ variant: "outline" })}>
            {signedIn ? t("account.confirmEmail.toSettings") : t("account.confirmEmail.login")}
          </Link>
        </>
      )}
    </AuthCard>
  );
}
