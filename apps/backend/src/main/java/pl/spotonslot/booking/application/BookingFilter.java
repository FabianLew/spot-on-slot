package pl.spotonslot.booking.application;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import pl.spotonslot.booking.BookingStatus;

/** What a list of the caller's bookings is narrowed to; null or empty fields do not filter. */
public record BookingFilter(Set<BookingStatus> statuses, UUID venueId, Instant from, Instant to, boolean awaitingMe) {

    public BookingFilter {
        statuses = statuses == null ? Set.of() : Set.copyOf(statuses);
    }
}
