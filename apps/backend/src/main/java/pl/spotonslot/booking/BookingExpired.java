package pl.spotonslot.booking;

import java.time.Instant;
import java.util.UUID;

/** A pending booking got no answer in time or its time started (stored by the job). {@code actorId} is the person who acted, null for the system. */
public record BookingExpired(UUID bookingId, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        BookingParty by, UUID actorId) {
}
