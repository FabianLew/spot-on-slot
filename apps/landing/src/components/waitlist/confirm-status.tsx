"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { Button } from "@spot-on-slot/ui";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";

type ConfirmState = "loading" | "confirmed" | "expired" | "invalid" | "network";

async function confirm(token: string): Promise<Exclude<ConfirmState, "loading">> {
  try {
    unwrap(await api.POST("/api/v1/waitlist/confirmations", { body: { token } }));
    return "confirmed";
  } catch (error) {
    const problem = toApiProblem(error);
    if (problem.code === "WAITLIST_TOKEN_EXPIRED") return "expired";
    // Server errors are transient like network failures, so they get the retry button too.
    if (problem.code === "NETWORK_ERROR" || problem.status === 0 || problem.status >= 500) return "network";
    return "invalid";
  }
}

export function ConfirmStatus({ token }: { token: string | null }) {
  const t = useTranslations("confirm");
  const [result, setResult] = useState<Exclude<ConfirmState, "loading"> | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A missing token needs no request; every other state comes from the request below.
  const state: ConfirmState = !token ? "invalid" : (result ?? "loading");

  useEffect(() => {
    if (!token) return;
    // The request is idempotent, so a duplicate (StrictMode) is harmless; the flag drops stale results.
    let ignore = false;
    void confirm(token).then((next) => {
      if (!ignore) setResult(next);
    });
    return () => {
      ignore = true;
    };
  }, [token, attempt]);

  const retry = () => {
    setResult(null);
    setAttempt((n) => n + 1);
  };

  if (state === "loading") {
    return (
      <p role="status" aria-busy="true" className="text-muted-foreground">
        {t("loading")}
      </p>
    );
  }

  const copy = state === "confirmed" ? "success" : state === "expired" ? "expired" : "invalid";
  const linkClass = "text-primary underline underline-offset-4";

  return (
    <div role="status" className="grid gap-4">
      <p>
        <strong className="font-semibold">{t(`${copy}.title`)}</strong> {t(`${copy}.text`)}
      </p>
      {state === "network" && (
        <div>
          <Button type="button" onClick={retry}>
            {t("retry")}
          </Button>
        </div>
      )}
      {state === "expired" ? (
        <Link href={{ pathname: "/", hash: "waitlist" }} className={linkClass}>
          {t("backHome")}
        </Link>
      ) : (
        <Link href="/" className={linkClass}>
          {t("backHome")}
        </Link>
      )}
    </div>
  );
}
