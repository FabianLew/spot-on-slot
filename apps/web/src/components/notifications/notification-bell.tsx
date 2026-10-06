"use client";

import { Bell } from "pixelarticons/react/Bell";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from "@spot-on-slot/ui";
import { NotificationList } from "./notification-list";
import { useUnreadCount } from "./queries";

/** Shown up to this number; more reads "9+". */
const MAX_BADGE = 9;

function BellIcon({ count }: { count: number }) {
  return (
    <span className="relative inline-flex">
      <Bell aria-hidden="true" className="size-6" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-2 min-w-5 border-2 border-card bg-primary px-1 text-center text-[0.625rem] font-bold leading-4 text-primary-foreground"
        >
          {count > MAX_BADGE ? `${MAX_BADGE}+` : count}
        </span>
      )}
    </span>
  );
}

/**
 * The bell with the unread count: on desktop (`panel`) it opens the list beside the page, on mobile (`link`) it goes
 * to `/notifications`.
 */
export function NotificationBell({
  variant,
  className,
}: {
  variant: "panel" | "link";
  className?: string;
}) {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const count = useUnreadCount().data ?? 0;
  const [open, setOpen] = useState(false);
  const label = count > 0 ? t("bellUnread", { count }) : t("title");

  if (variant === "link") {
    return (
      <Button asChild variant="ghost" size="icon" className={className}>
        <Link href="/notifications" aria-label={label}>
          <BellIcon count={count} />
        </Link>
      </Button>
    );
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn("shrink-0", className)}
        >
          <BellIcon count={count} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        closeLabel={tCommon("close")}
        className="w-full max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <NotificationList onNavigate={() => setOpen(false)} />
        <Link
          href="/settings#notifications"
          onClick={() => setOpen(false)}
          className="text-sm underline"
        >
          {t("settingsLink")}
        </Link>
      </SheetContent>
    </Sheet>
  );
}
