package pl.spotonslot.booking;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pl.spotonslot.booking.application.BookingService;

/** The module's facade for other modules (notifications, messaging). */
@Service
@RequiredArgsConstructor
public class Bookings {

    private final BookingService bookings;

    /** Whether the venue has an accepted booking overlapping {@code [from, to)} (it no longer looks for an artist). */
    public boolean venueHasAcceptedBetween(UUID venueId, Instant from, Instant to) {
        return bookings.venueHasAcceptedBetween(venueId, from, to);
    }

    public Optional<BookingInfo> find(UUID bookingId) {
        return bookings.find(bookingId);
    }
}
