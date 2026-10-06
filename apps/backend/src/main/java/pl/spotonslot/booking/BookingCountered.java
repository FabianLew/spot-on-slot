package pl.spotonslot.booking;

import java.time.Instant;
import java.util.UUID;

/** One side proposed new terms; the other side's turn. {@code actorId} is the person who acted, null for the system. */
public record BookingCountered(UUID bookingId, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        BookingParty by, UUID actorId) {
}
