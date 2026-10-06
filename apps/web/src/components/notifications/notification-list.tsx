"use client";

import { useTranslations } from "next-intl";
import { Button, Panel } from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { NotificationItem } from "./notification-item";
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
  type AppNotification,
} from "./queries";

/** The notification list, newest first, with "mark all read" and older pages on demand. */
export function NotificationList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("notifications");
  const list = useNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  if (list.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (list.isError)
    return <ApiErrorState error={list.error} onRetry={() => list.refetch()} />;

  const notifications = list.data.pages.flatMap((page) => page.content ?? []);
  if (notifications.length === 0)
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;

  function open(notification: AppNotification) {
    if (notification.readAt == null) markRead.mutate(notification.id);
    onNavigate?.();
  }

  return (
    <div className="flex flex-col gap-3">
      {(unread.data ?? 0) > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="self-end"
          disabled={markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          {t("markAll")}
        </Button>
      )}
      <ul className="flex flex-col gap-2">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onOpen={open}
          />
        ))}
      </ul>
      {list.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center"
          disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
        >
          {t("more")}
        </Button>
      )}
    </div>
  );
}
