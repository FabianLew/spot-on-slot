package pl.spotonslot.booking;

import java.time.Instant;
import java.util.UUID;

/** An accepted booking was cancelled before it started; the time is free again. {@code actorId} is the person who acted, null for the system. */
public record BookingCancelled(UUID bookingId, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        BookingParty by, UUID actorId) {
}
