"use client";

import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, toast } from "@spot-on-slot/ui";
import { api } from "@/lib/api";
import { fallbackMessage } from "@/lib/problem-text";
import { AuthNotice } from "./auth-card";

export async function resendVerification(email: string) {
  unwrap(await api.POST("/api/v1/auth/verify-email/resend", { body: { email } }));
}

/** Shown after sign-up: where the link went, and a way to send it again. */
export function CheckEmail({ email }: { email: string }) {
  const t = useTranslations();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function resend() {
    setState("sending");
    try {
      await resendVerification(email);
      setState("sent");
    } catch (error) {
      const problem = toApiProblem(error);
      toast.error(problem.detail || problem.title || fallbackMessage(t, problem));
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed">{t("auth.checkEmail.text", { email })}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("auth.checkEmail.noMail")}</p>
      {state === "sent" ? (
        <AuthNotice>{t("auth.checkEmail.resent")}</AuthNotice>
      ) : (
        <Button variant="outline" onClick={resend} disabled={state === "sending"} className="self-start">
          {t("auth.checkEmail.resend")}
        </Button>
      )}
    </div>
  );
}
