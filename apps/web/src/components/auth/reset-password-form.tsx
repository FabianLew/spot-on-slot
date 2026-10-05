"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, buttonVariants, Form, FormRootError, translateFormError } from "@spot-on-slot/ui";
import { api } from "@/lib/api";
import { AuthCard, AuthNotice, authLinkClass } from "./auth-card";
import { AuthField } from "./auth-field";
import { resetPasswordSchema, type ResetPasswordValues } from "./auth-schemas";
import { showServerError } from "./server-error";

export function ResetPasswordForm({ token }: { token?: string }) {
  const t = useTranslations();
  const [done, setDone] = useState(false);
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", passwordRepeat: "" },
  });

  async function onSubmit({ password }: ResetPasswordValues) {
    try {
      unwrap(await api.POST("/api/v1/auth/password-reset/confirm", { body: { token: token!, password } }));
      setDone(true);
    } catch (error) {
      showServerError(form, toApiProblem(error), t);
    }
  }

  const requestNew = (
    <Link href="/forgot-password" className={authLinkClass}>
      {t("auth.reset.requestNew")}
    </Link>
  );

  return (
    <AuthCard title={t("auth.reset.title")} footer={!done && token ? requestNew : undefined}>
      {done ? (
        <>
          <AuthNotice>{t("auth.reset.done")}</AuthNotice>
          <Link href="/login" className={buttonVariants()}>
            {t("auth.login.submit")}
          </Link>
        </>
      ) : !token ? (
        <>
          <p className="text-sm">{t("auth.reset.missingToken")}</p>
          {requestNew}
        </>
      ) : (
        <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
            <AuthField
              control={form.control}
              name="password"
              label={t("auth.fields.newPassword")}
              description={t("auth.fields.passwordHint")}
              type="password"
              autoComplete="new-password"
            />
            <AuthField
              control={form.control}
              name="passwordRepeat"
              label={t("auth.fields.passwordRepeat")}
              type="password"
              autoComplete="new-password"
            />
            <FormRootError />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t("auth.reset.submit")}
            </Button>
          </form>
        </Form>
      )}
    </AuthCard>
  );
}
