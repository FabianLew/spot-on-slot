package pl.spotonslot.booking;

import java.time.Instant;
import java.util.UUID;

/** A booking as other modules (messaging, notifications) see it, with its status as of now. */
public record BookingInfo(UUID id, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        BookingStatus status) {
}
