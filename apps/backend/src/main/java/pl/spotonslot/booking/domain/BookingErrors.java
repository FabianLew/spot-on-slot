package pl.spotonslot.booking.domain;

import pl.spotonslot.shared.error.BusinessRuleException;
import pl.spotonslot.shared.error.ConflictException;
import pl.spotonslot.shared.error.InvalidRequestException;
import pl.spotonslot.shared.error.NotFoundException;

/** Booking failures with their problem codes. */
public final class BookingErrors {

    private BookingErrors() {
    }

    /** No such booking, or the caller is neither its artist nor in its venue's team. */
    public static class BookingNotFound extends NotFoundException {
        public BookingNotFound() {
            super("BOOKING_NOT_FOUND");
        }
    }

    /** No published artist profile at that address. */
    public static class ArtistNotFound extends NotFoundException {
        public ArtistNotFound() {
            super("BOOKING_ARTIST_NOT_FOUND");
        }
    }

    /** No active listing of the right kind with that id. */
    public static class ListingNotFound extends NotFoundException {
        public ListingNotFound() {
            super("BOOKING_LISTING_NOT_FOUND");
        }
    }

    /** The venue does not exist or the caller is not in its team. */
    public static class VenueNotFound extends NotFoundException {
        public VenueNotFound() {
            super("BOOKING_VENUE_NOT_FOUND");
        }
    }

    public static class VenueNotPublished extends BusinessRuleException {
        public VenueNotPublished() {
            super("BOOKING_VENUE_NOT_PUBLISHED");
        }
    }

    /** Artists book with a published profile. */
    public static class ProfileRequired extends BusinessRuleException {
        public ProfileRequired() {
            super("BOOKING_PROFILE_REQUIRED");
        }
    }

    /** A venue's request names neither an artist nor an artist's listing, or an artist's names no venue listing. */
    public static class RequestInvalid extends InvalidRequestException {
        public RequestInvalid() {
            super("BOOKING_REQUEST_INVALID");
        }
    }

    /** The time is not free in the artist's calendar (venues) or overlaps their booked time (artists). */
    public static class NotFree extends ConflictException {
        public NotFree() {
            super("BOOKING_NOT_FREE");
        }
    }

    /** On acceptance: other time in the artist's calendar overlaps the booking only in part, or is booked. */
    public static class CalendarConflict extends ConflictException {
        public CalendarConflict() {
            super("BOOKING_CALENDAR_CONFLICT");
        }
    }

    /** The venue already waits on the artist for an overlapping time. */
    public static class Duplicate extends ConflictException {
        public Duplicate() {
            super("BOOKING_DUPLICATE");
        }
    }

    /** The acceptance names an older proposal than the current one. */
    public static class Stale extends ConflictException {
        public Stale() {
            super("BOOKING_STALE");
        }
    }

    /** The other side has to answer first (or, to withdraw, it is not the caller's proposal). */
    public static class NotYourTurn extends ConflictException {
        public NotYourTurn() {
            super("BOOKING_NOT_YOUR_TURN");
        }
    }

    /** The booking is no longer pending (or, to cancel, no longer accepted). */
    public static class Closed extends ConflictException {
        public Closed() {
            super("BOOKING_CLOSED");
        }
    }

    /** An accepted booking cannot be cancelled once it has started. */
    public static class Started extends BusinessRuleException {
        public Started() {
            super("BOOKING_STARTED");
        }
    }

    public static class InPast extends BusinessRuleException {
        public InPast() {
            super("BOOKING_IN_PAST");
        }
    }

    /** At most {@code maxDays} ahead. */
    public static class TooFar extends InvalidRequestException {
        public TooFar(long maxDays) {
            super("BOOKING_TOO_FAR", maxDays);
        }
    }

    /** From 30 minutes to 24 hours, ending after the start. */
    public static class DurationInvalid extends InvalidRequestException {
        public DurationInvalid() {
            super("BOOKING_DURATION_INVALID");
        }
    }

    /** Too many pending bookings; the argument is the limit. */
    public static class LimitReached extends BusinessRuleException {
        public LimitReached(int max) {
            super("BOOKING_LIMIT", max);
        }
    }
}
