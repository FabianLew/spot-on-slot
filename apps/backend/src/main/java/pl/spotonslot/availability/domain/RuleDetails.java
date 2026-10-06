package pl.spotonslot.availability.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

/** What the artist sets on a weekly rule; the dates are inclusive and {@code validUntil} may be open. */
public record RuleDetails(Set<DayOfWeek> days, LocalTime startTime, int durationMinutes, LocalDate validFrom,
        LocalDate validUntil, String note) {
}
