"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Form, FormRootError, toast, translateFormError } from "@spot-on-slot/ui";
import { safeNext } from "@/components/session/auth-gate";
import { useSession } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { fallbackMessage } from "@/lib/problem-text";
import { AuthCard, AuthNotice, authLinkClass } from "./auth-card";
import { AuthField } from "./auth-field";
import { loginSchema, type LoginValues } from "./auth-schemas";
import { resendVerification } from "./check-email";
import { showServerError } from "./server-error";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { session, signIn } = useSession();
  const [unverified, setUnverified] = useState<"no" | "yes" | "resent">("no");
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  // Signing in (or arriving with a live session) leads back to the page that asked for it.
  useEffect(() => {
    if (session.status === "authenticated") router.replace(safeNext(next));
  }, [session.status, next, router]);

  async function onSubmit(values: LoginValues) {
    setUnverified("no");
    try {
      await signIn(unwrap(await api.POST("/api/v1/auth/login", { body: values })));
    } catch (error) {
      const problem = toApiProblem(error);
      if (problem.code === "IDENTITY_EMAIL_NOT_VERIFIED") setUnverified("yes");
      showServerError(form, problem, t);
    }
  }

  async function resend() {
    try {
      await resendVerification(form.getValues("email"));
      form.clearErrors("root.server");
      setUnverified("resent");
    } catch (error) {
      const problem = toApiProblem(error);
      toast.error(problem.detail || problem.title || fallbackMessage(t, problem));
    }
  }

  return (
    <AuthCard
      title={t("auth.login.title")}
      footer={
        <>
          <Link href="/forgot-password" className={authLinkClass}>
            {t("auth.login.forgot")}
          </Link>
          <p>
            {t("auth.login.noAccount")}{" "}
            <Link href="/register" className={authLinkClass}>
              {t("auth.login.register")}
            </Link>
          </p>
        </>
      }
    >
      <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          <AuthField control={form.control} name="email" label={t("auth.fields.email")} type="email" autoComplete="email" />
          <AuthField
            control={form.control}
            name="password"
            label={t("auth.fields.password")}
            type="password"
            autoComplete="current-password"
          />
          <FormRootError />
          {unverified === "yes" && (
            <Button type="button" variant="outline" onClick={resend} className="self-start">
              {t("auth.login.resend")}
            </Button>
          )}
          {unverified === "resent" && <AuthNotice>{t("auth.login.resent")}</AuthNotice>}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("auth.login.submit")}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
