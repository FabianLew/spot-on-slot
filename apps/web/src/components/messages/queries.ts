"use client";

import { unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { useInfiniteQuery, useQuery, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Conversation = ApiSchemas["ConversationResponse"];
export type Message = ApiSchemas["MessageResponse"];
export type MessagePage = ApiSchemas["MessagePageResponse"];
export type History = InfiniteData<MessagePage, string | undefined>;

export const MESSAGES = ["messages"] as const;
export const LIST_SIZE = 20;
/** Older messages load this many at a time (the backend's maximum). */
export const HISTORY_SIZE = 50;
/** The list and the menu counter refresh this often, in case the live connection missed something. */
export const REFRESH_INTERVAL = 60_000;
export const MAX_LENGTH = 2000;

export const listKey = (venueId?: string) => [...MESSAGES, "list", venueId ?? "all"] as const;
export const conversationKey = (id: string) => [...MESSAGES, "one", id] as const;
export const historyKey = (id: string) => [...MESSAGES, "history", id] as const;
export const UNREAD = [...MESSAGES, "unread"] as const;

type Page = { conversations: Conversation[]; totalElements: number };

/** The caller's conversations, latest activity first, of one venue when `venueId` is set. */
export function useConversations(venueId?: string) {
  return useInfiniteQuery({
    queryKey: listKey(venueId),
    queryFn: async ({ pageParam }): Promise<Page> => {
      const query = { venueId, page: pageParam, size: LIST_SIZE };
      const page = unwrap(await api.GET("/api/v1/conversations", { params: { query } }));
      return { conversations: page.content ?? [], totalElements: page.totalElements ?? 0 };
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * LIST_SIZE < last.totalElements ? pages.length : undefined),
    refetchInterval: REFRESH_INTERVAL,
  });
}

/** One conversation, or null when the caller is not in it (404). */
export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationKey(id),
    queryFn: async (): Promise<Conversation | null> => {
      const result = await api.GET("/api/v1/conversations/{id}", { params: { path: { id } } });
      if (result.response.status === 404 || result.response.status === 400) return null;
      return unwrap(result);
    },
  });
}

/** The messages of a conversation, newest first, 50 per page; the next page is older. */
export function useHistory(id: string, enabled: boolean) {
  return useInfiniteQuery({
    enabled,
    queryKey: historyKey(id),
    queryFn: async ({ pageParam }): Promise<MessagePage> =>
      unwrap(
        await api.GET("/api/v1/conversations/{id}/messages", {
          params: { path: { id }, query: { before: pageParam, size: HISTORY_SIZE } },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.messages.at(-1)?.id : undefined),
  });
}

/** How many conversations have unread messages (the menu counter). */
export function useUnreadConversations(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: UNREAD,
    queryFn: async (): Promise<number> =>
      unwrap(await api.GET("/api/v1/conversations/unread-count")).conversations,
    refetchInterval: REFRESH_INTERVAL,
  });
}

/** Adds a message to the newest page of its conversation's history, unless it is there already. */
export function storeMessage(queryClient: QueryClient, message: Message) {
  queryClient.setQueryData<History>(historyKey(message.conversationId), (history) => {
    if (!history) return history;
    if (history.pages.some((page) => page.messages.some((item) => item.id === message.id))) return history;
    const [first, ...rest] = history.pages;
    return { ...history, pages: [{ ...first!, messages: [message, ...first!.messages] }, ...rest] };
  });
  queryClient.setQueryData<Conversation | null>(conversationKey(message.conversationId), (conversation) =>
    conversation ? { ...conversation, lastMessage: message, lastMessageAt: message.createdAt } : conversation,
  );
}

/** Moves the other side's read mark forward (never back). */
export function storeOtherRead(queryClient: QueryClient, conversationId: string, readUpTo: string) {
  const later = (current?: string) =>
    current != null && Date.parse(current) >= Date.parse(readUpTo) ? current : readUpTo;
  queryClient.setQueryData<Conversation | null>(conversationKey(conversationId), (conversation) =>
    conversation ? { ...conversation, otherReadUpTo: later(conversation.otherReadUpTo) } : conversation,
  );
  queryClient.setQueryData<History>(historyKey(conversationId), (history) => {
    if (!history) return history;
    const [first, ...rest] = history.pages;
    return { ...history, pages: [{ ...first!, otherReadUpTo: later(first!.otherReadUpTo) }, ...rest] };
  });
}

/** The caller's side in a conversation, if any cached query knows it. */
export function cachedParty(queryClient: QueryClient, conversationId: string): Conversation["myParty"] | undefined {
  const one = queryClient.getQueryData<Conversation | null>(conversationKey(conversationId));
  if (one) return one.myParty;
  for (const [, data] of queryClient.getQueriesData<InfiniteData<Page>>({ queryKey: [...MESSAGES, "list"] })) {
    const found = data?.pages.flatMap((page) => page.conversations).find((item) => item.id === conversationId);
    if (found) return found.myParty;
  }
  return undefined;
}

/** The list and the counter, after anything that changes the order or the unread numbers. */
export function refreshOverview(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [...MESSAGES, "list"] }),
    queryClient.invalidateQueries({ queryKey: UNREAD }),
  ]);
}

/** A profile link of the other side: venues talk to artists (`/a/`), artists to venues (`/v/`). */
export function otherHref(conversation: Conversation) {
  if (conversation.other.slug == null) return undefined;
  return `${conversation.myParty === "VENUE" ? "/a/" : "/v/"}${encodeURIComponent(conversation.other.slug)}`;
}
