package pl.spotonslot.booking;

import java.time.Instant;
import java.util.UUID;

/**
 * A booking as other modules (messaging, notifications) see it, with its status and current terms as of now.
 *
 * @param amount the current fee in grosze (0 = unpaid)
 */
public record BookingInfo(UUID id, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        BookingStatus status, String artistStageName, String venueName, long amount) {
}
