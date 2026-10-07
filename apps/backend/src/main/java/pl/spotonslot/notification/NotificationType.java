package pl.spotonslot.notification;

/** What a notification is about; each type has its own settings and texts. */
public enum NotificationType {
    /** A listing was posted nearby that fits the recipient ("Szukam artysty" for artists, "Jestem wolny" for venues). */
    NEARBY_LISTING,
    /** A step of one of the recipient's bookings, taken by the other side or the system. */
    BOOKING
}
