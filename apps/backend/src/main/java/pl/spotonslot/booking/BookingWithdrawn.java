package pl.spotonslot.booking;

import java.time.Instant;
import java.util.UUID;

/** The side that made the latest proposal took it back. {@code actorId} is the person who acted, null for the system. */
public record BookingWithdrawn(UUID bookingId, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        BookingParty by, UUID actorId) {
}
