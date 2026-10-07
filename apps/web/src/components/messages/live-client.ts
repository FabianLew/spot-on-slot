import { Client } from "@stomp/stompjs";
import type { Message } from "./queries";

/** What the backend pushes on `/user/queue/messages` once a write has committed. */
export type LiveEvent =
  | { type: "MESSAGE"; conversationId: string; message: Message }
  | { type: "READ"; conversationId: string; side: "ARTIST" | "VENUE"; readUpTo: string; messageId: string };

export type LiveOptions = {
  apiUrl: string;
  /** The current access token, refreshed when it is missing or about to expire. */
  token: () => Promise<string | null>;
  /** Asks for a new token on the next attempt, after the server refused the last one. */
  refresh: () => void;
  onEvent: (event: LiveEvent) => void;
  /** Every successful (re)connect: the page reloads what it may have missed meanwhile. */
  onConnect: (first: boolean) => void;
};

/** `https://api.example.pl` -> `wss://api.example.pl/ws`. */
export function liveUrl(apiUrl: string) {
  return `${apiUrl.replace(/^http/, "ws").replace(/\/$/, "")}/ws`;
}

const QUEUE = "/user/queue/messages";

/**
 * One STOMP connection for the signed-in session. The token goes in the CONNECT frame; a dropped connection
 * reconnects by itself (with a fresh token when needed). Returns the function that closes it.
 */
export function connectLive(options: LiveOptions): () => void {
  let connected = false;
  const client = new Client({
    brokerURL: liveUrl(options.apiUrl),
    reconnectDelay: 2_000,
    maxReconnectDelay: 30_000,
    heartbeatIncoming: 20_000,
    heartbeatOutgoing: 20_000,
    beforeConnect: async (self) => {
      const token = await options.token().catch(() => null);
      self.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    },
    onConnect: () => {
      client.subscribe(QUEUE, (frame) => {
        try {
          options.onEvent(JSON.parse(frame.body) as LiveEvent);
        } catch {
          // A frame we cannot read is skipped; the minute refresh catches up.
        }
      });
      options.onConnect(!connected);
      connected = true;
    },
    // The server answers an expired or missing token with an ERROR frame and closes the socket.
    onStompError: () => options.refresh(),
  });
  client.activate();
  return () => {
    void client.deactivate();
  };
}

/** Seconds until the JWT expires (negative = expired), or null when it cannot be read. */
export function secondsLeft(token: string, now = Date.now()): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp - now / 1000 : null;
  } catch {
    return null;
  }
}
