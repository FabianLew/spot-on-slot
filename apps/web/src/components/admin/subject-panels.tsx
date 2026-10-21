"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, Panel, toast } from "@spot-on-slot/ui";
import { adminActions } from "./actions";
import { StateTag, useWhen, type ReasonRequest } from "./admin-ui";
import { refreshAdmin, type ModerationAccount, type ModerationArtist, type ModerationVenue } from "./queries";

export type AskReason = (request: ReasonRequest) => void;

/** Runs an admin action, then refreshes the panel and confirms it. */
export function useAdminRun() {
  const queryClient = useQueryClient();
  return (action: (reason: string) => Promise<unknown>, done: string) => async (reason: string) => {
    await action(reason);
    await refreshAdmin(queryClient);
    toast.success(done);
  };
}

function Visibility({ published, hiddenAt, hiddenReason }: { published: boolean; hiddenAt?: string | null; hiddenReason?: string | null }) {
  const t = useTranslations("admin.subject");
  const when = useWhen();
  if (hiddenAt != null) {
    return (
      <p className="text-sm">
        <span className="font-bold uppercase">{t("hidden", { when: when(hiddenAt) })}</span>
        {hiddenReason != null && <span className="block break-words">{t("hiddenReason", { reason: hiddenReason })}</span>}
      </p>
    );
  }
  return <p className="text-sm font-bold uppercase">{published ? t("published") : t("draft")}</p>;
}

/** An artist profile with hiding or restoring. */
export function ArtistPanel({ artist, ask, title }: { artist: ModerationArtist; ask: AskReason; title?: string }) {
  const t = useTranslations("admin");
  const run = useAdminRun();
  const name = artist.stageName ?? artist.slug;
  return (
    <Panel title={title ?? t("subject.artist")} headingLevel={2}>
      <p className="font-display text-lg break-all">{name}</p>
      <Visibility published={artist.published} hiddenAt={artist.hiddenAt} hiddenReason={artist.hiddenReason} />
      <div className="flex flex-wrap gap-2">
        {artist.published && (
          <Button asChild variant="outline">
            <a href={`/a/${artist.slug}`} target="_blank" rel="noopener noreferrer">
              {t("subject.open")}
            </a>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href={`/admin/users/${artist.ownerId}`}>{t("subject.account")}</Link>
        </Button>
        {artist.hiddenAt == null ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() =>
              ask({
                title: t("hide.title", { name }),
                description: t("hide.artist"),
                confirm: t("hide.confirm"),
                destructive: true,
                run: run((reason) => adminActions.hideArtist(artist.profileId, reason), t("hide.done")),
              })
            }
          >
            {t("hide.button")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              ask({
                title: t("restore.title", { name }),
                description: t("restore.text"),
                confirm: t("restore.confirm"),
                run: run((reason) => adminActions.restoreArtist(artist.profileId, reason), t("restore.done")),
              })
            }
          >
            {t("restore.button")}
          </Button>
        )}
      </div>
    </Panel>
  );
}

/** A venue with hiding or restoring. */
export function VenuePanel({ venue, ask, title }: { venue: ModerationVenue; ask: AskReason; title?: string }) {
  const t = useTranslations("admin");
  const run = useAdminRun();
  return (
    <Panel title={title ?? t("subject.venue")} headingLevel={2}>
      <p className="font-display text-lg break-all">{venue.name}</p>
      {venue.city != null && <p className="text-sm">{venue.city}</p>}
      <p className="text-sm text-muted-foreground">{t("subject.team", { count: venue.team.length })}</p>
      <Visibility published={venue.published} hiddenAt={venue.hiddenAt} hiddenReason={venue.hiddenReason} />
      <div className="flex flex-wrap gap-2">
        {venue.published && (
          <Button asChild variant="outline">
            <a href={`/v/${venue.slug}`} target="_blank" rel="noopener noreferrer">
              {t("subject.open")}
            </a>
          </Button>
        )}
        {venue.hiddenAt == null ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() =>
              ask({
                title: t("hide.title", { name: venue.name }),
                description: t("hide.venue"),
                confirm: t("hide.confirm"),
                destructive: true,
                run: run((reason) => adminActions.hideVenue(venue.id, reason), t("hide.done")),
              })
            }
          >
            {t("hide.button")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              ask({
                title: t("restore.title", { name: venue.name }),
                description: t("restore.text"),
                confirm: t("restore.confirm"),
                run: run((reason) => adminActions.restoreVenue(venue.id, reason), t("restore.done")),
              })
            }
          >
            {t("restore.button")}
          </Button>
        )}
      </div>
    </Panel>
  );
}

/** Block or unblock an account; admins cannot block themselves. */
export function BlockButton({ account, ask, selfId }: { account: ModerationAccount; ask: AskReason; selfId?: string }) {
  const t = useTranslations("admin");
  const run = useAdminRun();
  if (account.id === selfId || account.state === "DELETION_PENDING") return null;
  return account.state === "BLOCKED" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        ask({
          title: t("unblock.title", { email: account.email }),
          description: t("unblock.text"),
          confirm: t("unblock.confirm"),
          run: run((reason) => adminActions.unblock(account.id, reason), t("unblock.done")),
        })
      }
    >
      {t("unblock.button")}
    </Button>
  ) : (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={() =>
        ask({
          title: t("block.title", { email: account.email }),
          description: t("block.text"),
          confirm: t("block.confirm"),
          destructive: true,
          run: run((reason) => adminActions.block(account.id, reason), t("block.done")),
        })
      }
    >
      {t("block.button")}
    </Button>
  );
}

/** Accounts behind a reported thing. */
export function OwnerList({ owners, ask, selfId }: { owners: ModerationAccount[]; ask: AskReason; selfId?: string }) {
  const t = useTranslations("admin");
  if (owners.length === 0) return <p className="text-sm text-muted-foreground">{t("owners.none")}</p>;
  return (
    <ul className="flex flex-col divide-y-2 divide-border border-2 border-border">
      {owners.map((owner) => (
        <li key={owner.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
          <Link href={`/admin/users/${owner.id}`} className="break-all font-bold underline">
            {owner.email}
          </Link>
          <StateTag state={owner.state} />
          <span className="ml-auto">
            <BlockButton account={owner} ask={ask} selfId={selfId} />
          </span>
        </li>
      ))}
    </ul>
  );
}
