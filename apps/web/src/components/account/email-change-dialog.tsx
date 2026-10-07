"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { unwrap } from "@spot-on-slot/api-client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Form, FormRootError, translateFormError } from "@spot-on-slot/ui";
import { AuthNotice } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";
import { api } from "@/lib/api";
import { AccountDialog } from "./account-dialog";
import { showAccountError } from "./account-errors";
import { emailChangeSchema, type EmailChangeValues } from "./account-schemas";

/** Asks for a link to the new address; the address changes only once that link is opened. */
export function EmailChangeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("account");
  return (
    <AccountDialog open={open} onClose={onClose} title={t("email.title")} description={t("email.hint")}>
      <EmailChangeForm onClose={onClose} />
    </AccountDialog>
  );
}

function EmailChangeForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<EmailChangeValues>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: { newEmail: "", currentPassword: "" },
  });

  async function onSubmit(values: EmailChangeValues) {
    try {
      unwrap(await api.POST("/api/v1/me/email-change", { body: values }));
      setSentTo(values.newEmail);
    } catch (failure) {
      showAccountError(form, failure, t);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-5">
        <AuthNotice>{t("account.email.sent", { email: sentTo })}</AuthNotice>
        <Button type="button" className="self-start" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    );
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <AuthField control={form.control} name="newEmail" label={t("account.email.newEmail")} type="email" autoComplete="email" />
        <AuthField
          control={form.control}
          name="currentPassword"
          label={t("account.currentPassword")}
          type="password"
          autoComplete="current-password"
        />
        <FormRootError />
        <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("account.email.sending") : t("account.email.submit")}
        </Button>
      </form>
    </Form>
  );
}
