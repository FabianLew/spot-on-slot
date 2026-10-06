package pl.spotonslot.availability.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;

/**
 * "Free every Friday 21:00-03:00": a weekly rule in the artist's time zone, so the local time holds across clock
 * changes. Dates are expanded on read; skipped dates are left out.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "availability_rule")
public class AvailabilityRule extends BaseEntity {

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Getter(AccessLevel.NONE)
    @ElementCollection
    @CollectionTable(name = "availability_rule_day", joinColumns = @JoinColumn(name = "rule_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 9)
    private Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Column(name = "time_zone", nullable = false, length = 40)
    private String timeZone;

    @Column(name = "note", length = 200)
    private String note;

    @Getter(AccessLevel.NONE)
    @ElementCollection
    @CollectionTable(name = "availability_rule_skip", joinColumns = @JoinColumn(name = "rule_id"))
    @Column(name = "day", nullable = false)
    private Set<LocalDate> skippedDates = new TreeSet<>();

    public static AvailabilityRule create(UUID ownerId, ZoneId zone, RuleDetails details) {
        var rule = new AvailabilityRule();
        rule.ownerId = ownerId;
        rule.timeZone = zone.getId();
        rule.update(details);
        return rule;
    }

    public void update(RuleDetails details) {
        days.clear();
        days.addAll(details.days());
        startTime = details.startTime();
        durationMinutes = details.durationMinutes();
        validFrom = details.validFrom();
        validUntil = details.validUntil();
        note = details.note();
    }

    /** Monday first. */
    public List<DayOfWeek> getDays() {
        return days.stream().sorted().toList();
    }

    public List<LocalDate> getSkippedDates() {
        return skippedDates.stream().sorted().toList();
    }

    public ZoneId zone() {
        return ZoneId.of(timeZone);
    }

    /** Whether the rule has a date there, skipped or not. */
    public boolean fallsOn(LocalDate date) {
        return days.contains(date.getDayOfWeek()) && !date.isBefore(validFrom)
                && (validUntil == null || !date.isAfter(validUntil));
    }

    public Occurrence occurrenceOn(LocalDate date) {
        var start = date.atTime(startTime).atZone(zone()).toInstant();
        return new Occurrence(start, start.plus(Duration.ofMinutes(durationMinutes)), SlotStatus.FREE, note,
                Occurrence.Source.RULE, null, getId(), date);
    }

    /** The rule's dates overlapping {@code [from, to)}, skipped ones left out, in order. */
    public List<Occurrence> occurrences(Instant from, Instant to) {
        var zone = zone();
        // A date that started the day before can still reach into the range (slots run up to 24 hours).
        var first = from.atZone(zone).toLocalDate().minusDays(1);
        if (first.isBefore(validFrom)) {
            first = validFrom;
        }
        var last = to.atZone(zone).toLocalDate();
        if (validUntil != null && last.isAfter(validUntil)) {
            last = validUntil;
        }
        var found = new ArrayList<Occurrence>();
        for (var date = first; !date.isAfter(last); date = date.plusDays(1)) {
            if (days.contains(date.getDayOfWeek()) && !skippedDates.contains(date)) {
                var occurrence = occurrenceOn(date);
                if (occurrence.overlaps(from, to)) {
                    found.add(occurrence);
                }
            }
        }
        return found;
    }

    public void skip(LocalDate date) {
        skippedDates.add(date);
    }

    public void restore(LocalDate date) {
        skippedDates.remove(date);
    }

    public boolean isSkipped(LocalDate date) {
        return skippedDates.contains(date);
    }
}
