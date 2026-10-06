package pl.spotonslot.booking;

import java.time.Instant;
import java.util.UUID;

/** A venue asked an artist, or an artist applied to a venue's listing. {@code actorId} is the person who acted, null for the system. */
public record BookingRequested(UUID bookingId, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        BookingParty by, UUID actorId) {
}
