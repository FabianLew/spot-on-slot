"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { unwrap } from "@spot-on-slot/api-client";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button, Form, FormRootError, toast, translateFormError } from "@spot-on-slot/ui";
import { AuthField } from "@/components/auth/auth-field";
import { api } from "@/lib/api";
import { AccountDialog } from "./account-dialog";
import { showAccountError } from "./account-errors";
import { passwordSchema, type PasswordValues } from "./account-schemas";

/** Current password, new one and its repeat; other devices are signed out, this one stays. */
export function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("account");
  return (
    <AccountDialog open={open} onClose={onClose} title={t("password.title")} description={t("password.hint")}>
      <PasswordForm onDone={onClose} />
    </AccountDialog>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations();
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", passwordRepeat: "" },
  });

  async function onSubmit({ currentPassword, newPassword }: PasswordValues) {
    try {
      unwrap(await api.PUT("/api/v1/me/password", { body: { currentPassword, newPassword } }));
      toast.success(t("account.password.changed"));
      onDone();
    } catch (failure) {
      showAccountError(form, failure, t);
    }
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <AuthField
          control={form.control}
          name="currentPassword"
          label={t("account.currentPassword")}
          type="password"
          autoComplete="current-password"
        />
        <AuthField
          control={form.control}
          name="newPassword"
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
        <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("account.password.saving") : t("account.password.submit")}
        </Button>
      </form>
    </Form>
  );
}
