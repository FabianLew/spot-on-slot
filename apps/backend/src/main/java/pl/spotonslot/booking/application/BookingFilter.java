package pl.spotonslot.booking.application;

import java.time.Instant;
import java.util.UUID;
import pl.spotonslot.booking.BookingStatus;

/** What a list of the caller's bookings is narrowed to; null fields do not filter. */
public record BookingFilter(BookingStatus status, UUID venueId, Instant from, Instant to, boolean awaitingMe) {
}
