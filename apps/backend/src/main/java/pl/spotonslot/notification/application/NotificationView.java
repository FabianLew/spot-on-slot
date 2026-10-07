package pl.spotonslot.notification.application;

import pl.spotonslot.notification.domain.BookingUpdate;
import pl.spotonslot.notification.domain.NearbyListingAlert;
import pl.spotonslot.notification.domain.Notification;

/**
 * A notification with its decoded payload (the one of its type is set); {@code active} tells whether what it points
 * to is still current (for {@code NEARBY_LISTING}: the listing is still active; bookings always are).
 */
public record NotificationView(Notification notification, NearbyListingAlert nearbyListing, BookingUpdate booking,
        boolean active) {
}
