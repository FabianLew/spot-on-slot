"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { PageHeader, Panel } from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useSession } from "@/components/session/session-provider";
import { ActionList, ReasonDialog, StateTag, useWhen, type ReasonRequest } from "./admin-ui";
import { useAdminUser } from "./queries";
import { ArtistPanel, BlockButton, VenuePanel } from "./subject-panels";

/** One account: its state and dates, what it runs (with hiding), how often it was reported, block, history. */
export function UserScreen({ userId }: { userId: string }) {
  const t = useTranslations("admin");
  const when = useWhen();
  const user = useAdminUser(userId);
  const { session } = useSession();
  const selfId = session.status === "authenticated" ? session.user.id : undefined;
  const [request, setRequest] = useState<ReasonRequest | null>(null);
  const back = (
    <Link href="/admin/users" aria-label={t("users.back")} className="px-2 font-display text-lg">
      ‹
    </Link>
  );

  if (user.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (user.isError) return <ApiErrorState error={user.error} onRetry={() => user.refetch()} />;
  if (!user.data) {
    return (
      <section className="flex flex-col gap-4">
        <PageHeader title={t("users.title")} back={back} />
        <Panel>
          <p className="text-sm">{t("users.notFound")}</p>
        </Panel>
      </section>
    );
  }
  const { account, artist, venues, reportsOpen, reportsTotal } = user.data.user;

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("users.detailTitle")} back={back} />
      <Panel title={<span className="break-all">{account.email}</span>} action={<BlockButton account={account} ask={setRequest} selfId={selfId} />}>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <StateTag state={account.state} />
          <span className="uppercase">{t(`role.${account.role}`)}</span>
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-bold uppercase text-muted-foreground">{t("users.joinedLabel")}</dt>
          <dd>{when(account.createdAt)}</dd>
          <dt className="font-bold uppercase text-muted-foreground">{t("users.lastSignInLabel")}</dt>
          <dd>{account.lastSignInAt != null ? when(account.lastSignInAt) : t("users.never")}</dd>
          <dt className="font-bold uppercase text-muted-foreground">{t("users.reportsLabel")}</dt>
          <dd>{t("users.reports", { total: reportsTotal, open: reportsOpen })}</dd>
          {account.blockedAt != null && (
            <>
              <dt className="font-bold uppercase text-muted-foreground">{t("users.blockedLabel")}</dt>
              <dd className="break-words">
                {when(account.blockedAt)}
                {account.blockReason != null && ` · ${account.blockReason}`}
              </dd>
            </>
          )}
          {account.deletionRequestedAt != null && (
            <>
              <dt className="font-bold uppercase text-muted-foreground">{t("users.deletionLabel")}</dt>
              <dd>{when(account.deletionRequestedAt)}</dd>
            </>
          )}
        </dl>
        {account.id === selfId && <p className="text-xs text-muted-foreground">{t("users.self")}</p>}
      </Panel>
      {artist != null && <ArtistPanel artist={artist} ask={setRequest} title={t("subject.artistProfile")} />}
      {venues.map((venue) => (
        <VenuePanel key={venue.id} venue={venue} ask={setRequest} />
      ))}
      <Panel title={t("history.title")}>
        <ActionList actions={user.data.actions} links={false} />
      </Panel>
      <ReasonDialog request={request} onClose={() => setRequest(null)} />
    </section>
  );
}
