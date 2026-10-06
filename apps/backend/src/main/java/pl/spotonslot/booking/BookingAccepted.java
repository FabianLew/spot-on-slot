package pl.spotonslot.booking;

import java.time.Instant;
import java.util.UUID;

/** The latest proposal was accepted and the artist's time is booked. {@code actorId} is the person who acted, null for the system. */
public record BookingAccepted(UUID bookingId, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        BookingParty by, UUID actorId) {
}
