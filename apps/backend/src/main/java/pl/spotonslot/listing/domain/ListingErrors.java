package pl.spotonslot.listing.domain;

import pl.spotonslot.shared.error.BusinessRuleException;
import pl.spotonslot.shared.error.ConflictException;
import pl.spotonslot.shared.error.InvalidRequestException;
import pl.spotonslot.shared.error.NotFoundException;

/** Listing failures with their problem codes. */
public final class ListingErrors {

    private ListingErrors() {
    }

    /** No such listing for this caller, or (publicly) no active one. */
    public static class ListingNotFound extends NotFoundException {
        public ListingNotFound() {
            super("LISTING_NOT_FOUND");
        }
    }

    /** The venue does not exist or the caller is not in its team. */
    public static class VenueNotFound extends NotFoundException {
        public VenueNotFound() {
            super("LISTING_VENUE_NOT_FOUND");
        }
    }

    public static class VenueNotPublished extends BusinessRuleException {
        public VenueNotPublished() {
            super("LISTING_VENUE_NOT_PUBLISHED");
        }
    }

    /** "I'm free" needs a published artist profile. */
    public static class ProfileRequired extends BusinessRuleException {
        public ProfileRequired() {
            super("LISTING_PROFILE_REQUIRED");
        }
    }

    /** The artist's calendar has no free time covering the listing. */
    public static class NotFree extends ConflictException {
        public NotFree() {
            super("LISTING_NOT_FREE");
        }
    }

    /** The artist already has an active listing overlapping this time. */
    public static class Duplicate extends ConflictException {
        public Duplicate() {
            super("LISTING_DUPLICATE");
        }
    }

    /** Closed, expired and filled listings cannot change. */
    public static class NotActive extends ConflictException {
        public NotActive() {
            super("LISTING_NOT_ACTIVE");
        }
    }

    public static class InPast extends BusinessRuleException {
        public InPast() {
            super("LISTING_IN_PAST");
        }
    }

    /** At most {@code maxDays} ahead. */
    public static class TooFar extends InvalidRequestException {
        public TooFar(long maxDays) {
            super("LISTING_TOO_FAR", maxDays);
        }
    }

    /** From 30 minutes to 24 hours, ending after the start. */
    public static class DurationInvalid extends InvalidRequestException {
        public DurationInvalid() {
            super("LISTING_DURATION_INVALID");
        }
    }

    /** Price "from" above price "to". */
    public static class PriceOrder extends InvalidRequestException {
        public PriceOrder() {
            super("LISTING_PRICE_ORDER");
        }
    }

    /** Artists' descriptions are shorter than venues'. */
    public static class DescriptionTooLong extends InvalidRequestException {
        public DescriptionTooLong(int max) {
            super("LISTING_DESCRIPTION_TOO_LONG", max);
        }
    }

    /** Too many active listings; the argument is the limit. */
    public static class LimitReached extends BusinessRuleException {
        public LimitReached(int max) {
            super("LISTING_LIMIT_REACHED", max);
        }
    }
}
