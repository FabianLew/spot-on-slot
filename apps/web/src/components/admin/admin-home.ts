import type { ReportKind } from "./queries";

/** Where admins land. Server-safe (imported by pages), so no "use client" here. */
export const ADMIN_HOME = "/admin/reports";

const KINDS = ["ARTIST", "VENUE", "LISTING", "CONVERSATION"] as const;

export function isReportKind(value: string): value is ReportKind {
  return (KINDS as readonly string[]).includes(value);
}

const ROLES = ["ARTIST", "VENUE", "ADMIN"] as const;
const STATES = ["ACTIVE", "PENDING_VERIFICATION", "BLOCKED", "DELETION_PENDING"] as const;

export function isAccountRole(value: string): value is (typeof ROLES)[number] {
  return (ROLES as readonly string[]).includes(value);
}

export function isAccountState(value: string): value is (typeof STATES)[number] {
  return (STATES as readonly string[]).includes(value);
}
