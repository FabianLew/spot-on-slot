"use client";

import { toApiProblem, unwrap, type ApiProblem, type ApiSchemas } from "@spot-on-slot/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, onSessionEnded, refreshSession, setAccessToken } from "@/lib/api";

export type SessionUser = ApiSchemas["MeResponse"];

export type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; user: SessionUser }
  | { status: "anonymous" }
  | { status: "error"; problem: ApiProblem };

interface SessionContextValue {
  session: SessionState;
  /** Stores the token from `/auth/login` and loads the user. */
  signIn: (token: ApiSchemas["AccessTokenResponse"]) => Promise<void>;
  signOut: () => Promise<void>;
  /** Restarts the startup check after it failed (e.g. offline). */
  retry: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function loadUser(): Promise<SessionUser> {
  return unwrap(await api.GET("/api/v1/me"));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => onSessionEnded(() => setSession({ status: "anonymous" })), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await refreshSession())) return; // onSessionEnded already marked the session anonymous
        const user = await loadUser();
        if (!cancelled) setSession({ status: "authenticated", user });
      } catch (error) {
        if (!cancelled) setSession({ status: "error", problem: toApiProblem(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const signIn = useCallback(async (token: ApiSchemas["AccessTokenResponse"]) => {
    setAccessToken(token);
    setSession({ status: "authenticated", user: await loadUser() });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.POST("/api/v1/auth/logout");
    } finally {
      // Signed out locally even when the request failed; the server-side token expires on its own.
      setAccessToken(null);
      queryClient.clear();
      setSession({ status: "anonymous" });
    }
  }, [queryClient]);

  const retry = useCallback(() => {
    setSession({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ session, signIn, signOut, retry }), [session, signIn, signOut, retry]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
