"use client";

import { useTranslations } from "next-intl";
import { PageHeader, Panel } from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { ActionList, LoadMore } from "./admin-ui";
import { useModerationHistory } from "./queries";

/** "Historia": every admin action, newest first; nothing in it can be edited. */
export function HistoryScreen() {
  const t = useTranslations("admin");
  const history = useModerationHistory();
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("history.title")} />
      <p className="text-sm text-muted-foreground">{t("history.intro")}</p>
      {history.isPending ? (
        <Panel aria-busy="true" className="h-40" />
      ) : history.isError ? (
        <ApiErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : (
        <>
          <ActionList actions={history.data.pages.flatMap((page) => page.items)} />
          <LoadMore show={history.hasNextPage} loading={history.isFetchingNextPage} onClick={() => history.fetchNextPage()} />
        </>
      )}
    </section>
  );
}
