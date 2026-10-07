"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "@/components/session/session-provider";
import { API_URL, getAccessToken, refreshSession } from "@/lib/api";
import { connectLive, secondsLeft, type LiveEvent } from "./live-client";
import { cachedParty, MESSAGES, refreshOverview, storeMessage, storeOtherRead } from "./queries";

/** A token this close to expiry is refreshed before connecting, so the CONNECT frame is not refused. */
const MARGIN_SECONDS = 30;

/** Applies one pushed event to the cached conversations, history and counter. */
export function applyLiveEvent(queryClient: QueryClient, event: LiveEvent) {
  if (event.type === "MESSAGE") {
    storeMessage(queryClient, event.message);
  } else {
    const party = cachedParty(queryClient, event.conversationId);
    // The other side read: "Przeczytane". My own side read (another tab, a teammate): only the counts change.
    if (party != null && party !== event.side) storeOtherRead(queryClient, event.conversationId, event.readUpTo);
    if (party == null) void queryClient.invalidateQueries({ queryKey: [...MESSAGES, "one", event.conversationId] });
  }
  void refreshOverview(queryClient);
}

/**
 * The live connection of a signed-in artist or venue account, kept for as long as the app is open. It renders
 * nothing; pushed events land in the query cache, and every reconnect reloads what may have been missed.
 */
export function LiveMessages() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session.status === "authenticated" ? session.user.id : null;
  const role = session.status === "authenticated" ? session.user.role : "";
  const party = role === "ARTIST" || role === "VENUE";

  useEffect(() => {
    if (userId == null || !party) return;
    let renew = false;
    return connectLive({
      apiUrl: API_URL,
      token: async () => {
        const current = getAccessToken();
        const left = current ? secondsLeft(current) : null;
        if (renew || current == null || (left != null && left < MARGIN_SECONDS)) {
          renew = false;
          await refreshSession();
        }
        return getAccessToken();
      },
      refresh: () => {
        renew = true;
      },
      onEvent: (event) => applyLiveEvent(queryClient, event),
      onConnect: (first) => {
        if (!first) void queryClient.invalidateQueries({ queryKey: MESSAGES });
      },
    });
  }, [queryClient, userId, party]);

  return null;
}
