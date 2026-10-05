"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { AuthCard, AuthNotice, authLinkClass } from "./auth-card";
import { EmailForm } from "./email-form";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [sentTo, setSentTo] = useState<string | null>(null);
  return (
    <AuthCard
      title={t("forgot.title")}
      footer={
        <Link href="/login" className={authLinkClass}>
          {t("backToLogin")}
        </Link>
      }
    >
      {sentTo ? (
        <AuthNotice>{t("forgot.sent", { email: sentTo })}</AuthNotice>
      ) : (
        <>
          <p className="text-sm leading-relaxed">{t("forgot.text")}</p>
          <EmailForm
            submitLabel={t("forgot.submit")}
            onSend={async (email) => {
              unwrap(await api.POST("/api/v1/auth/password-reset", { body: { email } }));
              setSentTo(email);
            }}
          />
        </>
      )}
    </AuthCard>
  );
}
