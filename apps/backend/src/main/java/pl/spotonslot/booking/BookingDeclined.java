package pl.spotonslot.booking;

import java.time.Instant;
import java.util.UUID;

/** The side whose turn it was declined (or the system, when the time got booked by another booking). {@code actorId} is the person who acted, null for the system. */
public record BookingDeclined(UUID bookingId, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        BookingParty by, UUID actorId) {
}
