package pl.spotonslot.booking.application;

import java.time.Instant;
import java.util.List;
import pl.spotonslot.booking.BookingParty;
import pl.spotonslot.booking.BookingStatus;
import pl.spotonslot.booking.domain.Booking;
import pl.spotonslot.booking.domain.BookingStepType;

/**
 * A booking as one of its sides sees it: the status and turn as of now, the side of the viewer and of the latest
 * proposal, the slugs of the published profiles (null once unpublished), the latest proposal's message and the
 * history, a time-based last step included before the job stores it.
 */
public record BookingView(Booking booking, BookingStatus status, BookingParty awaiting, BookingParty viewer,
        BookingParty proposer, String artistSlug, String venueSlug, String message, List<Step> steps) {

    public record Step(BookingStepType type, BookingParty party, boolean mine, Instant at, Instant startsAt,
            Instant endsAt, long amount, String message) {
    }
}
