package pl.spotonslot.availability.domain;

import pl.spotonslot.shared.error.BusinessRuleException;
import pl.spotonslot.shared.error.ConflictException;
import pl.spotonslot.shared.error.InvalidRequestException;
import pl.spotonslot.shared.error.NotFoundException;

/** Availability failures with their problem codes. */
public final class AvailabilityErrors {

    private AvailabilityErrors() {
    }

    /** Slots last from 30 minutes to 24 hours and end after they start. */
    public static class DurationInvalid extends InvalidRequestException {
        public DurationInvalid() {
            super("AVAILABILITY_DURATION_INVALID");
        }
    }

    /** Time that has already started cannot be added, changed or removed. */
    public static class InPast extends BusinessRuleException {
        public InPast() {
            super("AVAILABILITY_IN_PAST");
        }
    }

    /** Overlaps other time of the same artist; the argument is when that time starts (local, readable). */
    public static class Overlap extends ConflictException {
        public Overlap(String conflictingStart) {
            super("AVAILABILITY_OVERLAP", conflictingStart);
        }
    }

    public static class SlotNotFound extends NotFoundException {
        public SlotNotFound() {
            super("AVAILABILITY_SLOT_NOT_FOUND");
        }
    }

    public static class RuleNotFound extends NotFoundException {
        public RuleNotFound() {
            super("AVAILABILITY_RULE_NOT_FOUND");
        }
    }

    /** A booked slot changes only through its booking. */
    public static class SlotBooked extends ConflictException {
        public SlotBooked() {
            super("AVAILABILITY_SLOT_BOOKED");
        }
    }

    /** Calendar reads need {@code from < to} and at most {@code MAX_RANGE_DAYS}. */
    public static class RangeInvalid extends InvalidRequestException {
        public RangeInvalid(long maxDays) {
            super("AVAILABILITY_RANGE_INVALID", maxDays);
        }
    }

    public static class RuleDatesInvalid extends InvalidRequestException {
        public RuleDatesInvalid() {
            super("AVAILABILITY_RULE_DATES_INVALID");
        }
    }

    public static class NotARuleDate extends InvalidRequestException {
        public NotARuleDate() {
            super("AVAILABILITY_NOT_A_RULE_DATE");
        }
    }

    public static class LimitReached extends BusinessRuleException {
        public LimitReached() {
            super("AVAILABILITY_LIMIT_REACHED");
        }
    }

    /** The calendar belongs to an artist profile, so the profile comes first. */
    public static class ProfileRequired extends BusinessRuleException {
        public ProfileRequired() {
            super("AVAILABILITY_PROFILE_REQUIRED");
        }
    }

    /** No published artist under that address. */
    public static class ArtistNotFound extends NotFoundException {
        public ArtistNotFound() {
            super("AVAILABILITY_ARTIST_NOT_FOUND");
        }
    }

    /** Nothing free covers the time a booking wants. */
    public static class NotFree extends ConflictException {
        public NotFree() {
            super("AVAILABILITY_NOT_FREE");
        }
    }
}
