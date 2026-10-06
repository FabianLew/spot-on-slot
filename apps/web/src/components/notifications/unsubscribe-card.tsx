"use client";

import { createApiClient, toApiProblem } from "@spot-on-slot/api-client";
import { useMutation } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, Panel } from "@spot-on-slot/ui";

// No session needed: the token in the e-mail is the only credential.
const publicApi = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
});

/** Switches e-mails about listings nearby off for the token from the e-mail. */
export function UnsubscribeCard({ token }: { token: string | null }) {
  const t = useTranslations("notifications.unsubscribe");
  const unsubscribe = useMutation({
    meta: { handlesErrors: true },
    mutationFn: async () => {
      const result = await publicApi.POST(
        "/api/v1/public/notifications/unsubscribe",
        { body: { token: token! } },
      );
      if (!result.response.ok)
        throw toApiProblem(result.error, result.response.status);
    },
  });

  return (
    <Panel className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="font-display text-xl">{t("title")}</h1>
      {token == null || unsubscribe.isError ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {token == null ? t("missing") : t("invalid")}
        </p>
      ) : unsubscribe.isSuccess ? (
        <p role="status" className="text-sm">
          {t("done")}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
          <Button
            className="self-start"
            disabled={unsubscribe.isPending}
            onClick={() => unsubscribe.mutate()}
          >
            {t("button")}
          </Button>
        </>
      )}
      <Link href="/settings#notifications" className="text-sm underline">
        {t("settings")}
      </Link>
    </Panel>
  );
}
