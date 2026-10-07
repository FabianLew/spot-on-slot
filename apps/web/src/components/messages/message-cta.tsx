"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { buttonVariants, cn } from "@spot-on-slot/ui";
import { useSession } from "@/components/session/session-provider";

/** Who "Napisz" writes to: venues write to artists, artists to venues. */
export type MessageTarget = { kind: "artist" | "venue"; slug: string };

export const messageHref = (target: MessageTarget) => `/messages/new?${target.kind}=${encodeURIComponent(target.slug)}`;

/**
 * "Napisz" on a public profile. Signed-in accounts see it only when their role can write to that profile; anyone
 * else follows it through the login page (the messages pages require a session).
 */
export function MessageCta({ target, className }: { target: MessageTarget; className?: string }) {
  const t = useTranslations("messages");
  const { session } = useSession();
  const writer = target.kind === "artist" ? "VENUE" : "ARTIST";
  if (session.status === "authenticated" && session.user.role !== writer) return null;
  return (
    <Link
      href={messageHref(target)}
      className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-10 w-full py-2 text-center sm:w-auto", className)}
    >
      {t("write")}
    </Link>
  );
}
