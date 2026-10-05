"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@spot-on-slot/ui";
import { toApiProblem } from "@spot-on-slot/api-client";
import { fallbackMessage } from "@/lib/problem-text";

export function ApiErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations();
  const problem = toApiProblem(error);
  const title = problem.title || t("errors.title");
  const detail = problem.detail || (problem.title ? "" : fallbackMessage(t, problem));

  return (
    <section role="alert" className="flex flex-col items-start gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-danger">
        <CircleAlert aria-hidden className="size-6 shrink-0" />
        {title}
      </h1>
      {detail && <p className="text-muted-foreground">{detail}</p>}
      {problem.requestId && (
        <p className="text-sm text-muted-foreground">{t("errors.requestId", { id: problem.requestId })}</p>
      )}
      {onRetry && <Button onClick={onRetry}>{t("errors.retry")}</Button>}
    </section>
  );
}
