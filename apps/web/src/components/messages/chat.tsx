"use client";

import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleAlert, MoreVertical } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Textarea,
} from "@spot-on-slot/ui";
import { addDays, dayDate, local, today } from "@/components/calendar/warsaw-time";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { api } from "@/lib/api";
import { PartyPhoto } from "./party-photo";
import {
  conversationKey,
  MAX_LENGTH,
  otherHref,
  refreshOverview,
  storeMessage,
  useConversation,
  useHistory,
  type Conversation,
  type Message,
} from "./queries";

/** The counter under the field appears this close to the limit. */
const COUNTER_FROM = MAX_LENGTH - 200;

type Pending = { clientId: string; body: string; createdAt: string; failed: boolean };

/** One open conversation: header, history (older on scrolling up), read mark and the field to write in. */
export function Chat({ id, backHref }: { id: string; backHref: string }) {
  const t = useTranslations("messages");
  const conversation = useConversation(id);

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-96 flex-col border-2 border-border bg-card md:h-[calc(100dvh-11rem)]">
      {conversation.isPending ? (
        <div aria-busy="true" className="flex-1" />
      ) : conversation.isError ? (
        <div className="p-4">
          <ApiErrorState error={conversation.error} onRetry={() => conversation.refetch()} />
        </div>
      ) : conversation.data === null ? (
        <div className="flex flex-col gap-3 p-4">
          <BackLink href={backHref} />
          <h2 className="font-display text-lg">{t("notFoundTitle")}</h2>
          <p className="text-sm">{t("notFoundText")}</p>
        </div>
      ) : (
        <ChatBody conversation={conversation.data} backHref={backHref} />
      )}
    </div>
  );
}

function BackLink({ href, className }: { href: string; className?: string }) {
  const t = useTranslations("messages");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1 self-start text-xs font-bold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {t("back")}
    </Link>
  );
}

function ChatBody({ conversation, backHref }: { conversation: Conversation; backHref: string }) {
  const t = useTranslations("messages");
  const queryClient = useQueryClient();
  const history = useHistory(conversation.id, true);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stored = useMemo(
    () => (history.data?.pages.flatMap((page) => page.messages) ?? []).toReversed(),
    [history.data],
  );
  const storedIds = useMemo(() => new Set(stored.map((message) => message.clientId).filter(Boolean)), [stored]);
  const waiting = pending.filter((item) => !storedIds.has(item.clientId));
  const newest = stored.at(-1);

  useMarkRead(conversation, newest);

  async function deliver(item: Pending) {
    setPending((list) => [...list.filter((other) => other.clientId !== item.clientId), { ...item, failed: false }]);
    setError(null);
    try {
      const message = unwrap(
        await api.POST("/api/v1/conversations/{id}/messages", {
          params: { path: { id: conversation.id } },
          body: { body: item.body, clientId: item.clientId },
        }),
      );
      storeMessage(queryClient, message);
      setPending((list) => list.filter((other) => other.clientId !== item.clientId));
      void refreshOverview(queryClient);
    } catch (failure) {
      const problem = toApiProblem(failure);
      setPending((list) => list.map((other) => (other.clientId === item.clientId ? { ...other, failed: true } : other)));
      // Rate limit, blocked conversation and the like: the backend says why; a network failure only gets the retry.
      if (problem.status >= 400 && problem.status < 500 && problem.detail) setError(problem.detail);
      if (problem.code === "MESSAGING_BLOCKED") {
        void queryClient.invalidateQueries({ queryKey: conversationKey(conversation.id) });
      }
    }
  }

  return (
    <>
      <ChatHeader conversation={conversation} backHref={backHref} />
      {history.isPending ? (
        <div aria-busy="true" className="flex-1" />
      ) : history.isError ? (
        <div className="flex-1 p-4">
          <ApiErrorState error={history.error} onRetry={() => history.refetch()} />
        </div>
      ) : (
        <MessageList
          messages={stored}
          pending={waiting}
          readUpTo={latest(conversation.otherReadUpTo, history.data.pages[0]?.otherReadUpTo)}
          hasMore={history.hasNextPage}
          loadingMore={history.isFetchingNextPage}
          loadMore={() => history.fetchNextPage()}
          retry={(item) => void deliver(item)}
        />
      )}
      {conversation.canWrite ? (
        <Composer
          error={error}
          onSend={(body) =>
            void deliver({ clientId: crypto.randomUUID(), body, createdAt: new Date().toISOString(), failed: false })
          }
        />
      ) : (
        <Blocked conversation={conversation} />
      )}
      <span className="sr-only" aria-live="polite">
        {newest && !newest.mine ? t("liveNew", { name: conversation.other.name }) : ""}
      </span>
    </>
  );
}

const latest = (a?: string, b?: string) => (a == null ? b : b == null ? a : Date.parse(a) >= Date.parse(b) ? a : b);

/** Marks the conversation read up to its newest message while the tab is on top. */
function useMarkRead(conversation: Conversation, newest: Message | undefined) {
  const queryClient = useQueryClient();
  const marked = useRef<string | null>(null);
  const unread = conversation.unreadCount;

  useEffect(() => {
    if (!newest || marked.current === newest.id || (newest.mine && unread === 0)) return;
    const run = () => {
      if (document.visibilityState !== "visible" || marked.current === newest.id) return;
      marked.current = newest.id;
      void api
        .POST("/api/v1/conversations/{id}/read", {
          params: { path: { id: conversation.id } },
          body: { messageId: newest.id },
        })
        .then(() => {
          queryClient.setQueryData<Conversation | null>(conversationKey(conversation.id), (current) =>
            current ? { ...current, unreadCount: 0 } : current,
          );
          return refreshOverview(queryClient);
        })
        .catch(() => {
          marked.current = null;
        });
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [conversation.id, newest, unread, queryClient]);
}

function ChatHeader({ conversation, backHref }: { conversation: Conversation; backHref: string }) {
  const t = useTranslations("messages");
  const queryClient = useQueryClient();
  const href = otherHref(conversation);
  const [busy, setBusy] = useState(false);

  async function block(on: boolean) {
    if (on && !window.confirm(t("blockConfirm", { name: conversation.other.name }))) return;
    setBusy(true);
    try {
      const path = { params: { path: { id: conversation.id } } };
      unwrap(on ? await api.PUT("/api/v1/conversations/{id}/block", path) : await api.DELETE("/api/v1/conversations/{id}/block", path));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: conversationKey(conversation.id) }),
        refreshOverview(queryClient),
      ]);
    } finally {
      setBusy(false);
    }
  }

  const canBlock = conversation.kind === "DIRECT" && !conversation.blockedByOther;
  return (
    <div className="flex items-center gap-3 border-b-2 border-border p-3">
      <BackLink href={backHref} className="md:hidden" />
      <PartyPhoto conversation={conversation} className="hidden sm:flex" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="truncate font-display text-base leading-tight">
          {href ? (
            <Link href={href} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {conversation.other.name}
            </Link>
          ) : (
            conversation.other.name
          )}
        </h2>
        {conversation.kind === "BOOKING" && conversation.bookingId != null && (
          <Link
            href={`/bookings/${conversation.bookingId}`}
            className="self-start text-xs font-bold uppercase text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-highlight"
          >
            {t("seeBooking")}
          </Link>
        )}
      </div>
      {canBlock && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={t("menu")} disabled={busy}>
              <MoreVertical className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {conversation.blockedByMe ? (
              <DropdownMenuItem onSelect={() => void block(false)}>{t("unblock")}</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => void block(true)}>{t("block")}</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function MessageList({
  messages,
  pending,
  readUpTo,
  hasMore,
  loadingMore,
  loadMore,
  retry,
}: {
  messages: Message[];
  pending: Pending[];
  readUpTo?: string;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  retry: (item: Pending) => void;
}) {
  const t = useTranslations("messages");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const scroller = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const heightBefore = useRef<number | null>(null);

  const read =
    readUpTo == null
      ? undefined
      : messages.findLast((message) => message.mine && Date.parse(message.createdAt) <= Date.parse(readUpTo))?.id;
  const newestKey = pending.at(-1)?.clientId ?? messages.at(-1)?.id;
  const oldestId = messages[0]?.id;

  function older() {
    if (!hasMore || loadingMore) return;
    heightBefore.current = scroller.current?.scrollHeight ?? null;
    loadMore();
  }
  const olderRef = useRef(older);
  useEffect(() => {
    olderRef.current = older;
  });

  // Older messages arrive at the top: keep what the reader was looking at in place.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && heightBefore.current != null) {
      element.scrollTop += element.scrollHeight - heightBefore.current;
      heightBefore.current = null;
    }
  }, [oldestId]);

  // New messages arrive at the bottom: follow them while the reader is at the end (or just wrote).
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && (stick.current || pending.length > 0)) element.scrollTop = element.scrollHeight;
  }, [newestKey, pending.length]);

  useEffect(() => {
    const element = top.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) olderRef.current();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const todayKey = today();
  const dayLabel = (day: string) =>
    day === todayKey
      ? t("today")
      : day === addDays(todayKey, -1)
        ? t("yesterday")
        : format.dateTime(dayDate(day), {
            weekday: "long",
            day: "numeric",
            month: "long",
            ...(day.slice(0, 4) !== todayKey.slice(0, 4) && { year: "numeric" }),
            timeZone: "UTC",
          });

  const rows: { day: string; items: ({ kind: "stored"; message: Message } | { kind: "pending"; item: Pending })[] }[] =
    [];
  const push = (day: string, entry: (typeof rows)[number]["items"][number]) => {
    if (rows.at(-1)?.day !== day) rows.push({ day, items: [] });
    rows.at(-1)!.items.push(entry);
  };
  messages.forEach((message) => push(local(message.createdAt).day, { kind: "stored", message }));
  pending.forEach((item) => push(local(item.createdAt).day, { kind: "pending", item }));

  return (
    <div
      ref={scroller}
      onScroll={(event) => {
        const element = event.currentTarget;
        stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      }}
      className="flex flex-1 flex-col overflow-y-auto p-3"
      role="log"
      aria-label={t("historyLabel")}
    >
      <div ref={top} className="h-px shrink-0" />
      {hasMore && (
        <Button type="button" variant="outline" size="sm" className="self-center" disabled={loadingMore} onClick={older}>
          {loadingMore ? t("loadingOlder") : t("older")}
        </Button>
      )}
      {messages.length === 0 && pending.length === 0 && (
        <p className="m-auto max-w-xs text-center text-sm text-muted-foreground">{t("emptyChat")}</p>
      )}
      <div className="mt-auto flex flex-col gap-2">
        {rows.map((row) => (
          <section key={row.day} aria-label={dayLabel(row.day)} className="flex flex-col gap-2">
            <p className="my-2 self-center border-2 border-border bg-field px-2 py-0.5 text-[0.65rem] font-bold uppercase">
              {dayLabel(row.day)}
            </p>
            {row.items.map((entry) =>
              entry.kind === "stored" ? (
                <Bubble
                  key={entry.message.id}
                  mine={entry.message.mine}
                  body={entry.message.deleted ? tCommon("messageDeleted") : entry.message.body}
                  deleted={entry.message.deleted}
                >
                  <time dateTime={entry.message.createdAt}>{local(entry.message.createdAt).time}</time>
                  {entry.message.id === read && <span className="font-bold"> · {t("read")}</span>}
                </Bubble>
              ) : (
                <Bubble key={entry.item.clientId} mine body={entry.item.body} faded={!entry.item.failed}>
                  {entry.item.failed ? (
                    <span className="flex flex-wrap items-center justify-end gap-2 text-danger">
                      <CircleAlert className="size-3.5" aria-hidden="true" />
                      {t("failed")}
                      <button
                        type="button"
                        className="font-bold uppercase underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => retry(entry.item)}
                      >
                        {t("retry")}
                      </button>
                    </span>
                  ) : (
                    t("sending")
                  )}
                </Bubble>
              ),
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Bubble({
  mine,
  body,
  faded,
  deleted,
  children,
}: {
  mine: boolean;
  body: string;
  faded?: boolean;
  /** The author's account was deleted and the text with it. */
  deleted?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]", mine ? "items-end self-end" : "items-start self-start")}>
      <p
        className={cn(
          "whitespace-pre-wrap break-words border-2 px-3 py-2 text-sm",
          mine ? "border-primary bg-primary text-primary-foreground" : "border-border bg-field",
          faded && "opacity-70",
          deleted && "border-dashed border-border bg-transparent italic text-muted-foreground",
        )}
      >
        {body}
      </p>
      <p className="text-[0.7rem] text-muted-foreground tabular-nums">{children}</p>
    </div>
  );
}

function Composer({ error, onSend }: { error: string | null; onSend: (body: string) => void }) {
  const t = useTranslations("messages");
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);

  function send() {
    const body = text.trim();
    if (!body || body.length > MAX_LENGTH) return;
    onSend(body);
    setText("");
    field.current?.focus();
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <form
      className="flex flex-col gap-2 border-t-2 border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={field}
          rows={2}
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={keyDown}
          aria-label={t("field")}
          placeholder={t("placeholder")}
          className="min-h-11 resize-none rounded-none border-2"
        />
        <Button type="submit" disabled={text.trim().length === 0}>
          {t("send")}
        </Button>
      </div>
      <div className="flex justify-between gap-2 text-[0.7rem] text-muted-foreground">
        <span className="hidden sm:inline">{t("hint")}</span>
        {text.length >= COUNTER_FROM && (
          <span className="ml-auto tabular-nums" aria-live="polite">
            {t("counter", { count: text.length, max: MAX_LENGTH })}
          </span>
        )}
      </div>
    </form>
  );
}

function Blocked({ conversation }: { conversation: Conversation }) {
  const t = useTranslations("messages");
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-border p-3">
      <p className="text-sm">{t("blocked")}</p>
      {conversation.blockedByMe && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              unwrap(await api.DELETE("/api/v1/conversations/{id}/block", { params: { path: { id: conversation.id } } }));
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: conversationKey(conversation.id) }),
                refreshOverview(queryClient),
              ]);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("unblock")}
        </Button>
      )}
    </div>
  );
}

