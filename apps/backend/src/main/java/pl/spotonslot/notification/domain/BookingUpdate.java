package pl.spotonslot.notification.domain;

import java.time.Instant;
import java.util.UUID;
import pl.spotonslot.booking.BookingParty;

/**
 * What a {@code BOOKING} notification shows, frozen when it was made.
 *
 * @param side the recipient's side of the booking
 * @param by who took the step: the other side or the system
 * @param otherName the other side as the recipient sees it: the venue's name for the artist, the artist's stage name
 *     for the venue's team
 * @param amount the fee in grosze at that step (0 = unpaid)
 */
public record BookingUpdate(UUID bookingId, Kind kind, BookingParty side, BookingParty by, String otherName, Instant startsAt,
        Instant endsAt, long amount) {

    /** The step, after the booking event it comes from. */
    public enum Kind {
        REQUESTED,
        COUNTERED,
        ACCEPTED,
        DECLINED,
        WITHDRAWN,
        CANCELLED,
        EXPIRED
    }
}
