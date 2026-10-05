"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem } from "@spot-on-slot/api-client";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button, Form, FormRootError, translateFormError } from "@spot-on-slot/ui";
import { AuthField } from "./auth-field";
import { emailSchema, type EmailValues } from "./auth-schemas";
import { showServerError } from "./server-error";

/** One e-mail field and a button: resend the activation link, request a password reset. */
export function EmailForm({ submitLabel, onSend }: { submitLabel: string; onSend: (email: string) => Promise<void> }) {
  const t = useTranslations();
  const form = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });

  async function onSubmit({ email }: EmailValues) {
    try {
      await onSend(email);
    } catch (error) {
      showServerError(form, toApiProblem(error), t);
    }
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <AuthField control={form.control} name="email" label={t("auth.fields.email")} type="email" autoComplete="email" />
        <FormRootError />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}
