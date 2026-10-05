"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@spot-on-slot/ui";
import { api } from "@/lib/api";
import { AuthCard, AuthNotice, authLinkClass } from "./auth-card";
import { CheckEmail, resendVerification } from "./check-email";
import { EmailForm } from "./email-form";

type State = { step: "pending" } | { step: "verified" } | { step: "invalid" } | { step: "resent"; email: string };

/** Confirms the address from the e-mail link as soon as the page opens. */
export function VerifyEmail({ token }: { token?: string }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<State>(token ? { step: "pending" } : { step: "invalid" });
  // The token works once; React's dev double effect must not spend it twice.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    (async () => {
      try {
        unwrap(await api.POST("/api/v1/auth/verify-email", { body: { token } }));
        setState({ step: "verified" });
      } catch {
        // Any failure (used, expired, offline) ends in the same place: ask for a new link.
        setState({ step: "invalid" });
      }
    })();
  }, [token]);

  if (state.step === "resent") {
    return (
      <AuthCard title={t("checkEmail.title")}>
        <CheckEmail email={state.email} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("verify.title")}
      footer={
        state.step === "invalid" && (
          <Link href="/login" className={authLinkClass}>
            {t("backToLogin")}
          </Link>
        )
      }
    >
      {state.step === "pending" && (
        <p role="status" aria-busy="true" className="text-sm">
          {t("verify.pending")}
        </p>
      )}
      {state.step === "verified" && (
        <>
          <AuthNotice>{t("verify.success")}</AuthNotice>
          <Link href="/login" className={buttonVariants()}>
            {t("login.submit")}
          </Link>
        </>
      )}
      {state.step === "invalid" && (
        <>
          <p className="text-sm leading-relaxed">{t("verify.invalid")}</p>
          <EmailForm
            submitLabel={t("verify.resend")}
            onSend={async (email) => {
              await resendVerification(email);
              setState({ step: "resent", email });
            }}
          />
        </>
      )}
    </AuthCard>
  );
}
