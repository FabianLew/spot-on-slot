"use client";

import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  cn,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tag,
} from "@spot-on-slot/ui";
import { local, today, ZONE } from "@/components/calendar/warsaw-time";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useMyVenues } from "@/components/onboarding/queries";
import { useSession } from "@/components/session/session-provider";
import { Chat } from "./chat";
import { PartyPhoto } from "./party-photo";
import { useConversations, type Conversation } from "./queries";

const ALL = "all";

export const messagesHref = (venueId?: string, conversationId?: string) =>
  `/messages${conversationId ? `/${conversationId}` : ""}${venueId ? `?venue=${encodeURIComponent(venueId)}` : ""}`;

/**
 * The "Wiadomości" tab: the conversations and the open one. Side by side on a computer; on a phone the list, or the
 * open conversation on its own with "Wróć".
 */
export function MessagesScreen({ conversationId, venueId }: { conversationId?: string; venueId?: string }) {
  const t = useTranslations("messages");
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";
  const party = role === "ARTIST" || role === "VENUE";

  if (!party) {
    return (
      <section className="flex flex-col gap-4">
        <PageHeader title={t("title")} />
        <Panel>
          <p className="text-sm">{t("otherRole")}</p>
        </Panel>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <div className={cn(conversationId && "hidden md:block")}>
        <PageHeader title={t("title")} />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className={cn("flex min-w-0 flex-col gap-3", conversationId && "hidden md:flex")}>
          <ConversationList role={role} venueId={venueId} activeId={conversationId} />
        </div>
        <div className={cn("min-w-0", !conversationId && "hidden md:block")}>
          {conversationId ? (
            <Chat key={conversationId} id={conversationId} backHref={messagesHref(venueId)} />
          ) : (
            <Panel className="h-[calc(100dvh-11rem)] min-h-96 items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">{t("pick")}</p>
            </Panel>
          )}
        </div>
      </div>
    </section>
  );
}

function ConversationList({ role, venueId, activeId }: { role: string; venueId?: string; activeId?: string }) {
  const t = useTranslations("messages");
  const router = useRouter();
  const venues = useMyVenues(role === "VENUE");
  const list = role === "VENUE" ? (venues.data ?? []) : [];
  const venue = list.find((item) => item.id === venueId)?.id;
  const conversations = useConversations(venue);

  return (
    <>
      {list.length > 1 && (
        <div className="flex flex-col gap-2">
          <label htmlFor="messages-venue-switch" className="text-sm font-bold uppercase">
            {t("venueSwitch")}
          </label>
          <Select
            value={venue ?? ALL}
            onValueChange={(id) => router.replace(messagesHref(id === ALL ? undefined : id, activeId), { scroll: false })}
          >
            <SelectTrigger id="messages-venue-switch" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allVenues")}</SelectItem>
              {list.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {conversations.isPending ? (
        <Panel aria-busy="true" className="h-40" />
      ) : conversations.isError ? (
        <ApiErrorState error={conversations.error} onRetry={() => conversations.refetch()} />
      ) : conversations.data.pages[0]!.conversations.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          <p className="text-sm">{role === "VENUE" ? t("startVenue") : t("startArtist")}</p>
          <Button asChild variant="outline" className="self-start">
            <Link href={role === "VENUE" ? "/search?tab=artists" : "/search?tab=venues"}>{t("goSearch")}</Link>
          </Button>
        </Panel>
      ) : (
        <>
          <ul aria-label={t("listLabel")} className="flex flex-col border-2 border-border bg-card">
            {conversations.data.pages.flatMap((page) =>
              page.conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  href={messagesHref(venue, conversation.id)}
                  active={conversation.id === activeId}
                />
              )),
            )}
          </ul>
          {conversations.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              className="self-center"
              disabled={conversations.isFetchingNextPage}
              onClick={() => conversations.fetchNextPage()}
            >
              {t("more")}
            </Button>
          )}
        </>
      )}
    </>
  );
}

function ConversationItem({ conversation, href, active }: { conversation: Conversation; href: string; active: boolean }) {
  const t = useTranslations("messages");
  const format = useFormatter();
  const last = conversation.lastMessage;
  const unread = conversation.unreadCount;

  return (
    <li className="border-b-2 border-border last:border-b-0">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-start gap-3 p-3 hover:bg-muted focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active && "bg-muted",
        )}
      >
        <PartyPhoto conversation={conversation} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", unread > 0 ? "font-bold" : "font-medium")}>
              {conversation.other.name}
            </span>
            {last && (
              <time dateTime={last.createdAt} className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {local(last.createdAt).day === today()
                  ? local(last.createdAt).time
                  : format.dateTime(new Date(last.createdAt), { day: "numeric", month: "short", timeZone: ZONE })}
              </time>
            )}
          </span>
          {conversation.kind === "BOOKING" && (
            <span>
              <Tag className="px-1.5 py-0.5 text-[0.65rem]">
                {conversation.bookingStartsAt != null
                  ? t("bookingTag", {
                      date: format.dateTime(new Date(conversation.bookingStartsAt), {
                        day: "numeric",
                        month: "short",
                        timeZone: ZONE,
                      }),
                    })
                  : t("bookingTagNoDate")}
              </Tag>
            </span>
          )}
          <span className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-xs", unread > 0 ? "text-foreground" : "text-muted-foreground")}>
              {last ? (last.mine ? t("mine", { text: last.body }) : last.body) : t("noMessages")}
            </span>
            {unread > 0 && (
              <span className="shrink-0 bg-primary px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-primary-foreground">
                {unread}
                <span className="sr-only"> {t("unread", { count: unread })}</span>
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
