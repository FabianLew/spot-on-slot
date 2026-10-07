"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useForm } from "react-hook-form";
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  translateFormError,
} from "@spot-on-slot/ui";
import { authLinkClass } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useSession } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { AccountDialog } from "./account-dialog";
import { showAccountError } from "./account-errors";
import { deletionSchema, type DeletionValues } from "./account-schemas";

const CONSEQUENCES = ["hidden", "bookings", "restore", "final", "history"] as const;

/** Explains what deleting does and asks for the password; last owners of shared venues are sent to the team first. */
export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("account.delete");
  return (
    <AccountDialog open={open} onClose={onClose} title={t("title")}>
      <DeletionBody />
    </AccountDialog>
  );
}

function DeletionBody() {
  const t = useTranslations("account.delete");
  const check = useQuery({
    queryKey: ["account", "deletion"],
    queryFn: async () => unwrap(await api.GET("/api/v1/me/deletion")),
    staleTime: 0,
    gcTime: 0,
  });

  if (check.isError) return <ApiErrorState error={check.error} onRetry={() => check.refetch()} />;
  if (check.isPending) {
    return (
      <p role="status" aria-busy="true" className="text-sm">
        {t("loading")}
      </p>
    );
  }
  const { blockers, graceDays } = check.data;
  if (blockers.length > 0) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="flex items-start gap-2 text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("blocked")}
        </p>
        <ul className="flex flex-col gap-2">
          {blockers.map((blocker) => (
            <li key={blocker.id}>
              <Link href={`/profile/venues/${blocker.id}/team`} className={authLinkClass}>
                {t("team", { name: blocker.name })}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-2 text-sm">
        <p className="font-bold">{t("whatHappens")}</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
          {CONSEQUENCES.map((key) => (
            <li key={key}>{t(`consequences.${key}`, { days: graceDays })}</li>
          ))}
        </ul>
      </div>
      <DeletionForm onBlocked={() => void check.refetch()} />
    </>
  );
}

function DeletionForm({ onBlocked }: { onBlocked: () => void }) {
  const t = useTranslations();
  const { signOut } = useSession();
  const form = useForm<DeletionValues>({
    resolver: zodResolver(deletionSchema),
    defaultValues: { password: "", confirm: false },
  });

  async function onSubmit({ password }: DeletionValues) {
    try {
      const { deletionScheduledAt } = unwrap(
        await api.POST("/api/v1/me/deletion", { body: { password, confirm: true } }),
      );
      // Every session is revoked by now; signing out locally lands on the login page with the date.
      await signOut({ redirectTo: `/login?deleted=${encodeURIComponent(deletionScheduledAt)}` });
    } catch (failure) {
      if (toApiProblem(failure).code === "ACCOUNT_LAST_VENUE_OWNER") onBlocked();
      showAccountError(form, failure, t);
    }
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <AuthField
          control={form.control}
          name="password"
          label={t("account.currentPassword")}
          type="password"
          autoComplete="current-password"
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className="mt-0.5 size-5 rounded-none border-2"
                  />
                </FormControl>
                <FormLabel className="leading-snug">{t("account.delete.understand")}</FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormRootError />
        <Button type="submit" variant="destructive" className="self-start" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("account.delete.deleting") : t("account.delete.confirm")}
        </Button>
      </form>
    </Form>
  );
}
