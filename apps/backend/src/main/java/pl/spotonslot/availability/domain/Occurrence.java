package pl.spotonslot.availability.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One concrete stretch of time in an artist's calendar: a single slot, or one date of a weekly rule
 * ({@code ruleId} and {@code date} set). A booked slot names the booking that holds it.
 */
public record Occurrence(Instant startsAt, Instant endsAt, SlotStatus status, String note, Source source, UUID slotId,
        UUID ruleId, LocalDate date, UUID bookingId) {

    public enum Source {
        SLOT,
        RULE
    }

    public boolean overlaps(Instant from, Instant to) {
        return startsAt.isBefore(to) && endsAt.isAfter(from);
    }

    public boolean covers(Instant from, Instant to) {
        return !startsAt.isAfter(from) && !endsAt.isBefore(to);
    }

    public boolean isFree() {
        return status == SlotStatus.FREE;
    }
}
