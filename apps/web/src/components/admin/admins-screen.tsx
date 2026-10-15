"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  Input,
  PageHeader,
  Panel,
  toast,
  translateFormError,
} from "@spot-on-slot/ui";
import { showServerError } from "@/components/auth/server-error";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { api } from "@/lib/api";
import { StateTag, useWhen } from "./admin-ui";
import { refreshAdmin, useAdmins } from "./queries";

/** "Admini": the admin accounts and adding one by e-mail (a link to set the password goes there). */
export function AdminsScreen() {
  const t = useTranslations("admin");
  const when = useWhen();
  const admins = useAdmins();
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("admins.title")} />
      <Panel
        title={t("admins.listTitle")}
        action={
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            {t("admins.add")}
          </Button>
        }
      >
        {admins.isPending ? (
          <div aria-busy="true" className="h-20" />
        ) : admins.isError ? (
          <ApiErrorState error={admins.error} onRetry={() => admins.refetch()} />
        ) : (
          <ul className="flex flex-col divide-y-2 divide-border border-2 border-border">
            {admins.data.map((admin) => (
              <li key={admin.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="font-bold break-all">{admin.email}</span>
                <StateTag state={admin.state} />
                <span className="ml-auto text-xs text-muted-foreground">
                  {admin.lastSignInAt != null
                    ? t("users.lastSignIn", { when: when(admin.lastSignInAt) })
                    : t("admins.neverSignedIn")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <AddAdminDialog open={adding} onClose={() => setAdding(false)} />
    </section>
  );
}

const schema = z.object({ email: z.string().trim().min(1, "validation.required").email("validation.email") });
type Values = z.infer<typeof schema>;

function AddAdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {open && (
        <DialogContent closeLabel={t("common.close")} className="rounded-none border-2 border-border">
          <DialogHeader>
            <DialogTitle className="uppercase">{t("admin.admins.addTitle")}</DialogTitle>
            <DialogDescription>{t("admin.admins.addText")}</DialogDescription>
          </DialogHeader>
          <AddAdminForm onDone={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function AddAdminForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(values: Values) {
    try {
      const admin = unwrap(await api.POST("/api/v1/admin/admins", { body: { email: values.email } }));
      await refreshAdmin(queryClient);
      toast.success(t("admin.admins.added", { email: admin.email }));
      onDone();
    } catch (failure) {
      showServerError(form, toApiProblem(failure), t);
    }
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.admins.email")}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormRootError />
        <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
          {t("admin.admins.send")}
        </Button>
      </form>
    </Form>
  );
}
