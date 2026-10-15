"use client";

import { unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { useInfiniteQuery, useQuery, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type ReportTargetSummary = ApiSchemas["ReportTargetSummary"];
export type ReportTargetDetail = ApiSchemas["ReportTargetDetail"];
export type ReportKind = ReportTargetSummary["kind"];
export type ReportReason = ReportTargetSummary["reasons"][number];
export type ReportItem = ApiSchemas["ReportItem"];
export type ModerationArtist = ApiSchemas["ModerationArtist"];
export type ModerationVenue = ApiSchemas["ModerationVenue"];
export type ModerationListing = ApiSchemas["ModerationListing"];
export type ModerationAccount = ApiSchemas["ModerationAccount"];
export type ModerationAction = ApiSchemas["ModerationActionEntry"];
export type AdminUser = ApiSchemas["AdminUser"];
export type AdminUserDetail = ApiSchemas["AdminUserDetail"];
export type AccountRole = ModerationAccount["role"];
export type AccountState = ModerationAccount["state"];

export const REPORT_KINDS: ReportKind[] = ["ARTIST", "VENUE", "LISTING", "CONVERSATION"];
export const REPORT_REASONS: ReportReason[] = ["SPAM", "FRAUD", "OFFENSIVE", "IMPERSONATION", "MISLEADING", "OTHER"];
export const ACCOUNT_ROLES: AccountRole[] = ["ARTIST", "VENUE", "ADMIN"];
export const ACCOUNT_STATES: AccountState[] = ["ACTIVE", "PENDING_VERIFICATION", "BLOCKED", "DELETION_PENDING"];

export const ADMIN = ["admin"] as const;
export const PAGE_SIZE = 20;
/** How often the menu counter looks for new reports. */
export const COUNT_INTERVAL = 60_000;

const nextPage = (last: { totalElements: number }, pages: unknown[]) =>
  pages.length * PAGE_SIZE < last.totalElements ? pages.length : undefined;

/** Reported things with open reports, the longest waiting first. */
export function useReportQueue(kind?: ReportKind) {
  return useInfiniteQuery({
    queryKey: [...ADMIN, "reports", kind ?? "all"],
    queryFn: async ({ pageParam }) => {
      const page = unwrap(
        await api.GET("/api/v1/admin/reports", { params: { query: { kind, page: pageParam, size: PAGE_SIZE } } }),
      );
      return { items: page.content ?? [], totalElements: page.totalElements ?? 0 };
    },
    initialPageParam: 0,
    getNextPageParam: nextPage,
  });
}

/** Open reports for the menu counter. */
export function useOpenReportCount(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: [...ADMIN, "reports", "count"],
    queryFn: async () => unwrap(await api.GET("/api/v1/admin/reports/count")),
    refetchInterval: COUNT_INTERVAL,
  });
}

/** One reported thing, or null when nothing of that kind was reported under the id. */
export function useReportTarget(kind: ReportKind, targetId: string) {
  return useQuery({
    queryKey: [...ADMIN, "reports", "target", kind, targetId],
    queryFn: async (): Promise<ReportTargetDetail | null> => {
      const result = await api.GET("/api/v1/admin/reports/{kind}/{targetId}", {
        params: { path: { kind, targetId } },
      });
      if (result.response.status === 404 || result.response.status === 400) return null;
      return unwrap(result);
    },
  });
}

export type UserFilter = { q?: string; role?: AccountRole; state?: AccountState };

export function useAdminUsers(filter: UserFilter) {
  return useInfiniteQuery({
    queryKey: [...ADMIN, "users", "list", filter.q ?? "", filter.role ?? "", filter.state ?? ""],
    queryFn: async ({ pageParam }) => {
      const query = { q: filter.q || undefined, role: filter.role, state: filter.state, page: pageParam, size: PAGE_SIZE };
      const page = unwrap(await api.GET("/api/v1/admin/users", { params: { query } }));
      return { items: page.content ?? [], totalElements: page.totalElements ?? 0 };
    },
    initialPageParam: 0,
    getNextPageParam: nextPage,
  });
}

/** One account, or null for an unknown id. */
export function useAdminUser(userId: string) {
  return useQuery({
    queryKey: [...ADMIN, "users", "one", userId],
    queryFn: async (): Promise<AdminUserDetail | null> => {
      const result = await api.GET("/api/v1/admin/users/{userId}", { params: { path: { userId } } });
      if (result.response.status === 404 || result.response.status === 400) return null;
      return unwrap(result);
    },
  });
}

export function useModerationHistory() {
  return useInfiniteQuery({
    queryKey: [...ADMIN, "actions"],
    queryFn: async ({ pageParam }) => {
      const page = unwrap(
        await api.GET("/api/v1/admin/actions", { params: { query: { page: pageParam, size: PAGE_SIZE } } }),
      );
      return { items: page.content ?? [], totalElements: page.totalElements ?? 0 };
    },
    initialPageParam: 0,
    getNextPageParam: nextPage,
  });
}

export function useAdmins() {
  return useQuery({
    queryKey: [...ADMIN, "admins"],
    queryFn: async () => unwrap(await api.GET("/api/v1/admin/admins")),
  });
}

/** After any admin action: the queue, counts, details and the history may all have changed. */
export const refreshAdmin = (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: ADMIN });
