"use client";

import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Button, PageHeader, Panel, Tag, cn } from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useSession } from "@/components/session/session-provider";
import { adminActions } from "./actions";
import { ActionList, KindTag, ReasonDialog, useWhen, type ReasonRequest } from "./admin-ui";
import { useReportTarget, type ModerationListing, type ReportItem, type ReportKind } from "./queries";
import { ArtistPanel, OwnerList, VenuePanel, useAdminRun, type AskReason } from "./subject-panels";

/** One reported thing: what it is now, who runs it, every report of it and what admins did, with the actions. */
export function ReportTargetScreen({ kind, targetId }: { kind: ReportKind; targetId: string }) {
  const t = useTranslations("admin");
  const target = useReportTarget(kind, targetId);
  const { session } = useSession();
  const selfId = session.status === "authenticated" ? session.user.id : undefined;
  const [request, setRequest] = useState<ReasonRequest | null>(null);
  const run = useAdminRun();

  const back = (
    <Link href="/admin/reports" aria-label={t("reports.back")} className="px-2 font-display text-lg">
      ‹
    </Link>
  );

  if (target.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (target.isError) return <ApiErrorState error={target.error} onRetry={() => target.refetch()} />;
  const detail = target.data;
  if (!detail) {
    return (
      <section className="flex flex-col gap-4">
        <PageHeader title={t("reports.title")} back={back} />
        <Panel>
          <p className="text-sm">{t("target.notFound")}</p>
        </Panel>
      </section>
    );
  }

  const open = detail.reports.filter((report) => report.status === "OPEN");
  const ask: AskReason = setRequest;

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={detail.label} back={back} />
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <KindTag kind={detail.kind} />
        {t("target.summary", { open: open.length, total: detail.reports.length })}
      </p>

      {detail.kind === "ARTIST" &&
        (detail.artist != null ? <ArtistPanel artist={detail.artist} ask={ask} /> : <Gone />)}
      {detail.kind === "VENUE" && (detail.venue != null ? <VenuePanel venue={detail.venue} ask={ask} /> : <Gone />)}
      {detail.kind === "LISTING" &&
        (detail.listing != null ? <ListingPanel listing={detail.listing} ask={ask} /> : <Gone />)}
      {detail.kind === "CONVERSATION" && (
        <Panel title={t("subject.conversation")}>
          <p className="text-sm text-muted-foreground">{t("target.conversationNote")}</p>
        </Panel>
      )}

      <Panel title={t("owners.title")}>
        <OwnerList owners={detail.owners} ask={ask} selfId={selfId} />
      </Panel>

      <Panel
        title={t("target.reports")}
        action={
          open.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRequest({
                  title: t("dismiss.title"),
                  description: t("dismiss.text", { count: open.length }),
                  confirm: t("dismiss.confirm"),
                  run: run((note) => adminActions.dismiss(detail.kind, detail.targetId, note), t("dismiss.done")),
                })
              }
            >
              {t("dismiss.button")}
            </Button>
          )
        }
      >
        <ol className="flex flex-col gap-3">
          {detail.reports.map((report) => (
            <ReportEntry key={report.id} report={report} kind={detail.kind} />
          ))}
        </ol>
      </Panel>

      <Panel title={t("history.title")}>
        <ActionList actions={detail.actions} />
      </Panel>

      <ReasonDialog request={request} onClose={() => setRequest(null)} />
    </section>
  );
}

function Gone() {
  const t = useTranslations("admin");
  return (
    <Panel>
      <p className="text-sm">{t("target.gone")}</p>
    </Panel>
  );
}

function ListingPanel({ listing, ask }: { listing: ModerationListing; ask: AskReason }) {
  const t = useTranslations();
  const format = useFormatter();
  const run = useAdminRun();
  const when = format.dateTimeRange(new Date(listing.startsAt), new Date(listing.endsAt), {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const author = listing.artist?.stageName ?? listing.venue?.name ?? t("admin.deleted");
  return (
    <Panel title={t("admin.subject.listing")}>
      <p className="font-display text-lg">
        {listing.kind === "ARTIST_AVAILABLE" ? t("admin.listingKind.ARTIST_AVAILABLE") : t("admin.listingKind.VENUE_SEEKING")}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-bold uppercase text-muted-foreground">{t("admin.listing.author")}</dt>
        <dd className="break-all">
          {listing.artist != null ? (
            <Link className="underline" href={`/admin/users/${listing.artist.ownerId}`}>
              {author}
            </Link>
          ) : (
            author
          )}
        </dd>
        <dt className="font-bold uppercase text-muted-foreground">{t("admin.listing.when")}</dt>
        <dd>{when}</dd>
        {listing.city != null && (
          <>
            <dt className="font-bold uppercase text-muted-foreground">{t("admin.listing.city")}</dt>
            <dd>{listing.city}</dd>
          </>
        )}
        <dt className="font-bold uppercase text-muted-foreground">{t("admin.listing.status")}</dt>
        <dd>{t(`admin.listingStatus.${listing.status as "ACTIVE"}`)}</dd>
      </dl>
      {listing.genres.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {listing.genres.map((genre) => (
            <li key={genre}>
              <Tag className="text-[0.625rem]">{t(`genres.${genre}`)}</Tag>
            </li>
          ))}
        </ul>
      )}
      {listing.description != null && <p className="text-sm break-words whitespace-pre-line">{listing.description}</p>}
      {listing.moderationReason != null && (
        <p className="text-sm">{t("admin.listing.closedReason", { reason: listing.moderationReason })}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {listing.status === "ACTIVE" && (
          <>
            <Button asChild variant="outline">
              <a href={`/o/${listing.id}`} target="_blank" rel="noopener noreferrer">
                {t("admin.subject.open")}
              </a>
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                ask({
                  title: t("admin.close.title"),
                  description: t("admin.close.text"),
                  confirm: t("admin.close.confirm"),
                  destructive: true,
                  run: run((reason) => adminActions.closeListing(listing.id, reason), t("admin.close.done")),
                })
              }
            >
              {t("admin.close.button")}
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
}

function ReportEntry({ report, kind }: { report: ReportItem; kind: ReportKind }) {
  const t = useTranslations("admin");
  const when = useWhen();
  return (
    <li className={cn("flex flex-col gap-2 border-2 p-3 text-sm", report.status === "OPEN" ? "border-primary" : "border-border")}>
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-bold uppercase">{t(`reason.${report.reason}`)}</span>
        <Tag className="text-[0.625rem]">{t(`reportStatus.${report.status}`)}</Tag>
        <span className="ml-auto text-xs text-muted-foreground">{when(report.createdAt)}</span>
      </p>
      {report.description != null && <p className="break-words whitespace-pre-line">{report.description}</p>}
      <p className="text-xs text-muted-foreground">
        {report.reporterId != null ? (
          <>
            {t("target.reporter")}{" "}
            <Link href={`/admin/users/${report.reporterId}`} className="break-all underline">
              {report.reporterEmail ?? report.reporterId}
            </Link>
          </>
        ) : (
          t("target.reporterDeleted")
        )}
      </p>
      {report.resolutionNote != null && report.status !== "OPEN" && (
        <p className="text-xs">{t("target.resolution", { note: report.resolutionNote })}</p>
      )}
      {kind === "CONVERSATION" && report.messages != null && <Snapshot messages={report.messages} />}
    </li>
  );
}

function Snapshot({ messages }: { messages: NonNullable<ReportItem["messages"]> }) {
  const t = useTranslations("admin");
  const when = useWhen();
  if (messages.length === 0) return <p className="text-xs text-muted-foreground">{t("snapshot.empty")}</p>;
  return (
    <details open className="border-2 border-border">
      <summary className="cursor-pointer p-2 text-xs font-bold uppercase">
        {t("snapshot.title", { count: messages.length })}
      </summary>
      <ol className="flex flex-col gap-2 p-2">
        {messages.map((message, index) => (
          <li
            key={`${message.createdAt}-${index}`}
            className={cn("flex max-w-[85%] flex-col gap-0.5 border-2 p-2", message.reporter ? "self-end border-border" : "self-start border-primary")}
          >
            <span className="text-[0.625rem] font-bold uppercase text-muted-foreground">
              {message.reporter ? t("snapshot.reporter") : t("snapshot.other")} · {when(message.createdAt)}
            </span>
            <span className="break-words whitespace-pre-line">
              {message.deleted ? <em className="text-muted-foreground">{t("snapshot.deleted")}</em> : message.body}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
