package pl.spotonslot.notification.domain;

import pl.spotonslot.shared.error.NotFoundException;

/** Notification failures with their problem codes. */
public final class NotificationErrors {

    private NotificationErrors() {
    }

    /** No such notification for this user. */
    public static class NotificationNotFound extends NotFoundException {
        public NotificationNotFound() {
            super("NOTIFICATION_NOT_FOUND");
        }
    }

    /** The unsubscribe link is unknown. */
    public static class UnsubscribeInvalid extends NotFoundException {
        public UnsubscribeInvalid() {
            super("NOTIFICATION_UNSUBSCRIBE_INVALID");
        }
    }
}
