"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, Panel, Tag } from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { Empty, FilterGroup, KindTag, LoadMore, useWhen } from "./admin-ui";
import { REPORT_KINDS, useReportQueue, type ReportKind, type ReportTargetSummary } from "./queries";

const ALL = "ALL";

/** "Zgłoszenia": reported things with open reports, the longest waiting first, by kind (`?kind=`). */
export function ReportsScreen({ kind }: { kind?: ReportKind }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const queue = useReportQueue(kind);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("reports.title")} />
      <p className="text-sm text-muted-foreground">{t("reports.intro")}</p>
      <FilterGroup<ReportKind | typeof ALL>
        label={t("reports.filter")}
        options={[{ value: ALL, label: t("reports.all") }, ...REPORT_KINDS.map((value) => ({ value, label: t(`kind.${value}`) }))]}
        value={kind ?? ALL}
        onChange={(value) => router.replace(value === ALL ? "/admin/reports" : `/admin/reports?kind=${value}`, { scroll: false })}
      />
      {queue.isPending ? (
        <Panel aria-busy="true" className="h-40" />
      ) : queue.isError ? (
        <ApiErrorState error={queue.error} onRetry={() => queue.refetch()} />
      ) : queue.data.pages[0]!.items.length === 0 ? (
        <Empty>{t("reports.empty")}</Empty>
      ) : (
        <>
          <ul aria-label={t("reports.listLabel")} className="flex flex-col gap-3">
            {queue.data.pages.flatMap((page) => page.items.map((item) => <QueueItem key={`${item.kind}-${item.targetId}`} item={item} />))}
          </ul>
          <LoadMore show={queue.hasNextPage} loading={queue.isFetchingNextPage} onClick={() => queue.fetchNextPage()} />
        </>
      )}
    </section>
  );
}

function QueueItem({ item }: { item: ReportTargetSummary }) {
  const t = useTranslations("admin");
  const when = useWhen();
  return (
    <li>
      <Link
        href={`/admin/reports/${item.kind}/${item.targetId}`}
        className="flex flex-col gap-2 border-2 border-border bg-card p-4 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex flex-wrap items-center gap-2">
          <KindTag kind={item.kind} />
          <span className="font-display text-base break-all">{item.label}</span>
          <span className="ml-auto text-sm font-bold">{t("reports.count", { count: item.openCount })}</span>
        </span>
        <span className="flex flex-wrap gap-1">
          {item.reasons.map((reason) => (
            <Tag key={reason} className="text-[0.625rem]">
              {t(`reason.${reason}`)}
            </Tag>
          ))}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("reports.waiting", { since: when(item.firstReportedAt), last: when(item.lastReportedAt) })}
        </span>
      </Link>
    </li>
  );
}
