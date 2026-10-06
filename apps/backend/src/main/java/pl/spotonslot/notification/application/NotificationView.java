package pl.spotonslot.notification.application;

import pl.spotonslot.notification.domain.NearbyListingAlert;
import pl.spotonslot.notification.domain.Notification;

/**
 * A notification with its decoded payload; {@code active} tells whether what it points to is still current (for
 * {@code NEARBY_LISTING}: the listing is still active).
 */
public record NotificationView(Notification notification, NearbyListingAlert nearbyListing, boolean active) {
}
