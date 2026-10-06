package pl.spotonslot.availability.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.availability.AvailabilityChanged;
import pl.spotonslot.availability.domain.AvailabilityErrors;
import pl.spotonslot.availability.domain.AvailabilityRule;
import pl.spotonslot.availability.domain.AvailabilitySlot;
import pl.spotonslot.availability.domain.Occurrence;
import pl.spotonslot.availability.domain.RuleDetails;
import pl.spotonslot.availability.infrastructure.AvailabilityRuleRepository;
import pl.spotonslot.availability.infrastructure.AvailabilitySlotRepository;

/** Artists' calendars: single slots, weekly rules, the public view, and booking holds for other modules. */
@Service
@RequiredArgsConstructor
public class AvailabilityService {

    /** Until accounts pick a time zone, every artist plans in Polish time. */
    public static final ZoneId DEFAULT_ZONE = ZoneId.of("Europe/Warsaw");
    public static final long MAX_RANGE_DAYS = 92;
    public static final int MAX_RULES = 20;
    public static final int MAX_FUTURE_SLOTS = 500;
    static final Duration MIN_LENGTH = Duration.ofMinutes(30);
    static final Duration MAX_LENGTH = Duration.ofHours(24);
    /** Rules expand at most this far ahead. */
    static final Duration HORIZON = Duration.ofDays(366);

    private static final DateTimeFormatter READABLE = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");
    private static final Comparator<Occurrence> BY_START = Comparator.comparing(Occurrence::startsAt);

    private final AvailabilitySlotRepository slots;
    private final AvailabilityRuleRepository rules;
    private final ArtistProfiles artistProfiles;
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    // ---- the artist's own calendar

    @Transactional(readOnly = true)
    public List<Occurrence> calendar(UUID ownerId, Instant from, Instant to) {
        requireProfile(ownerId);
        checkRange(from, to);
        return occurrences(ownerId, from, to);
    }

    @Transactional
    public AvailabilitySlot addSlot(UUID ownerId, Instant startsAt, Instant endsAt, String note) {
        requireProfile(ownerId);
        checkSlot(startsAt, endsAt);
        lock(ownerId);
        if (slots.countByOwnerIdAndStartsAtAfter(ownerId, now()) >= MAX_FUTURE_SLOTS) {
            throw new AvailabilityErrors.LimitReached();
        }
        checkFree(ownerId, List.of(new Occurrence(startsAt, endsAt, null, null, null, null, null, null, null)), o -> false);
        return slots.save(AvailabilitySlot.free(ownerId, startsAt, endsAt, note));
    }

    @Transactional
    public AvailabilitySlot updateSlot(UUID ownerId, UUID slotId, Instant startsAt, Instant endsAt, String note) {
        requireProfile(ownerId);
        lock(ownerId);
        var slot = changeableSlot(ownerId, slotId);
        checkSlot(startsAt, endsAt);
        checkFree(ownerId, List.of(new Occurrence(startsAt, endsAt, null, null, null, null, null, null, null)),
                o -> slotId.equals(o.slotId()));
        slot.change(startsAt, endsAt, note);
        changed(ownerId);
        return slot;
    }

    @Transactional
    public void deleteSlot(UUID ownerId, UUID slotId) {
        requireProfile(ownerId);
        slots.delete(changeableSlot(ownerId, slotId));
        changed(ownerId);
    }

    @Transactional(readOnly = true)
    public List<AvailabilityRule> listRules(UUID ownerId) {
        requireProfile(ownerId);
        return rules.findByOwnerIdInOrderByCreatedAt(List.of(ownerId));
    }

    @Transactional
    public AvailabilityRule addRule(UUID ownerId, RuleDetails details) {
        requireProfile(ownerId);
        checkRule(details, null);
        lock(ownerId);
        if (rules.countByOwnerId(ownerId) >= MAX_RULES) {
            throw new AvailabilityErrors.LimitReached();
        }
        var rule = AvailabilityRule.create(ownerId, DEFAULT_ZONE, details);
        checkRuleFree(rule);
        return rules.save(rule);
    }

    @Transactional
    public AvailabilityRule updateRule(UUID ownerId, UUID ruleId, RuleDetails details) {
        requireProfile(ownerId);
        lock(ownerId);
        var rule = rule(ownerId, ruleId);
        checkRule(details, rule);
        rule.update(details);
        checkRuleFree(rule);
        changed(ownerId);
        return rule;
    }

    @Transactional
    public void deleteRule(UUID ownerId, UUID ruleId) {
        requireProfile(ownerId);
        rules.delete(rule(ownerId, ruleId));
        changed(ownerId);
    }

    /** Leaves one date of a rule out (a day off); dates that have started stay as they were. */
    @Transactional
    public AvailabilityRule skipDate(UUID ownerId, UUID ruleId, LocalDate date) {
        requireProfile(ownerId);
        var rule = rule(ownerId, ruleId);
        changeableDate(rule, date);
        rule.skip(date);
        changed(ownerId);
        return rule;
    }

    /** Brings a skipped date back, unless other time has taken its place meanwhile. */
    @Transactional
    public AvailabilityRule restoreDate(UUID ownerId, UUID ruleId, LocalDate date) {
        requireProfile(ownerId);
        lock(ownerId);
        var rule = rule(ownerId, ruleId);
        if (!rule.isSkipped(date)) {
            changeableDate(rule, date);
            return rule;
        }
        var occurrence = changeableDate(rule, date);
        checkFree(ownerId, List.of(occurrence), o -> false);
        rule.restore(date);
        return rule;
    }

    // ---- public view

    @Transactional(readOnly = true)
    public List<Occurrence> publicCalendar(String slug, Instant from, Instant to) {
        checkRange(from, to);
        var artist = artistProfiles.findPublishedBySlug(slug).orElseThrow(AvailabilityErrors.ArtistNotFound::new);
        return occurrences(artist.ownerId(), from, to);
    }

    // ---- for other modules (facade)

    @Transactional(readOnly = true)
    public Set<UUID> freeAmong(Collection<UUID> owners, Instant from, Instant to) {
        if (owners.isEmpty() || !from.isBefore(to)) {
            return Set.of();
        }
        var free = new LinkedHashSet<UUID>();
        slots.findOverlapping(owners, from, to).stream()
                .filter(slot -> !slot.isBooked() && slot.toOccurrence().covers(from, to))
                .forEach(slot -> free.add(slot.getOwnerId()));
        rules.findByOwnerIdInOrderByCreatedAt(owners).stream()
                .filter(rule -> rule.occurrences(from, to).stream()
                        .anyMatch(o -> o.covers(from, to) && !booked(rule.getOwnerId(), o)))
                .forEach(rule -> free.add(rule.getOwnerId()));
        return free;
    }

    /** Takes free time for a booking: a slot turns booked, a rule date becomes its own booked slot. */
    @Transactional
    public void occupy(UUID ownerId, Instant from, Instant to, UUID bookingId) {
        lock(ownerId);
        var free = occurrences(ownerId, from, to).stream()
                .filter(o -> o.isFree() && o.covers(from, to))
                .findFirst()
                .orElseThrow(AvailabilityErrors.NotFree::new);
        take(ownerId, free, bookingId);
    }

    /**
     * Books {@code [from, to)} for a booking: free time covering it turns booked as a whole; with nothing in the
     * calendar overlapping it, a booked slot of exactly that time is added. Returns false (changing nothing) when
     * other time overlaps it only in part or is booked.
     */
    @Transactional
    public boolean hold(UUID ownerId, Instant from, Instant to, UUID bookingId) {
        lock(ownerId);
        var overlapping = occurrences(ownerId, from, to);
        var free = overlapping.stream().filter(o -> o.isFree() && o.covers(from, to)).findFirst();
        if (free.isPresent()) {
            take(ownerId, free.get(), bookingId);
            return true;
        }
        if (!overlapping.isEmpty()) {
            return false;
        }
        slots.save(AvailabilitySlot.booked(ownerId, from, to, null, bookingId));
        changed(ownerId);
        return true;
    }

    /** Whether any booked time of the artist overlaps {@code [from, to)}. */
    @Transactional(readOnly = true)
    public boolean isBooked(UUID ownerId, Instant from, Instant to) {
        return slots.findOverlapping(List.of(ownerId), from, to).stream().anyMatch(AvailabilitySlot::isBooked);
    }

    private void take(UUID ownerId, Occurrence free, UUID bookingId) {
        if (free.source() == Occurrence.Source.SLOT) {
            slots.findById(free.slotId()).orElseThrow().occupy(bookingId);
        } else {
            rules.findById(free.ruleId()).orElseThrow().skip(free.date());
            slots.save(AvailabilitySlot.booked(ownerId, free.startsAt(), free.endsAt(), free.note(), bookingId));
        }
        changed(ownerId);
    }

    /** Gives a booking's time back as free time; unknown bookings change nothing. */
    @Transactional
    public void release(UUID bookingId) {
        slots.findByBookingId(bookingId).ifPresent(AvailabilitySlot::release);
    }

    // ---- internals

    /** Tells other modules (listings) that some free time of the artist may be gone. */
    private void changed(UUID ownerId) {
        events.publishEvent(new AvailabilityChanged(ownerId));
    }

    /** Slots and rule dates overlapping {@code [from, to)}, in order; rules stop at the horizon. */
    private List<Occurrence> occurrences(UUID ownerId, Instant from, Instant to) {
        var found = new ArrayList<Occurrence>();
        slots.findOverlapping(List.of(ownerId), from, to).forEach(slot -> found.add(slot.toOccurrence()));
        var horizon = now().plus(HORIZON);
        var ruleTo = to.isAfter(horizon) ? horizon : to;
        if (from.isBefore(ruleTo)) {
            rules.findByOwnerIdInOrderByCreatedAt(List.of(ownerId))
                    .forEach(rule -> found.addAll(rule.occurrences(from, ruleTo)));
        }
        found.sort(BY_START);
        return found;
    }

    private boolean booked(UUID ownerId, Occurrence occurrence) {
        return slots.findOverlapping(List.of(ownerId), occurrence.startsAt(), occurrence.endsAt()).stream()
                .anyMatch(AvailabilitySlot::isBooked);
    }

    /** Fails with the first existing time (other than {@code ignored}) that overlaps any of {@code wanted}. */
    private void checkFree(UUID ownerId, List<Occurrence> wanted, Predicate<Occurrence> ignored) {
        if (wanted.isEmpty()) {
            return;
        }
        var from = wanted.getFirst().startsAt();
        var to = wanted.getLast().endsAt();
        for (var occurrence : wanted) {
            from = occurrence.startsAt().isBefore(from) ? occurrence.startsAt() : from;
            to = occurrence.endsAt().isAfter(to) ? occurrence.endsAt() : to;
        }
        var existing = occurrences(ownerId, from, to).stream().filter(ignored.negate()).toList();
        for (var occurrence : wanted) {
            for (var other : existing) {
                if (other.overlaps(occurrence.startsAt(), occurrence.endsAt())) {
                    throw new AvailabilityErrors.Overlap(READABLE.format(other.startsAt().atZone(DEFAULT_ZONE)));
                }
            }
        }
    }

    /** A rule's coming dates (up to the horizon) must not overlap other time of the artist. */
    private void checkRuleFree(AvailabilityRule rule) {
        var now = now();
        var wanted = rule.occurrences(now, now.plus(HORIZON)).stream()
                .filter(o -> o.startsAt().isAfter(now))
                .toList();
        checkFree(rule.getOwnerId(), wanted, o -> rule.getId().equals(o.ruleId()));
    }

    private void checkSlot(Instant startsAt, Instant endsAt) {
        var length = Duration.between(startsAt, endsAt);
        if (length.compareTo(MIN_LENGTH) < 0 || length.compareTo(MAX_LENGTH) > 0) {
            throw new AvailabilityErrors.DurationInvalid();
        }
        if (!startsAt.isAfter(now())) {
            throw new AvailabilityErrors.InPast();
        }
    }

    private void checkRule(RuleDetails details, AvailabilityRule current) {
        var length = Duration.ofMinutes(details.durationMinutes());
        if (length.compareTo(MIN_LENGTH) < 0 || length.compareTo(MAX_LENGTH) > 0) {
            throw new AvailabilityErrors.DurationInvalid();
        }
        if (details.validUntil() != null && details.validUntil().isBefore(details.validFrom())) {
            throw new AvailabilityErrors.RuleDatesInvalid();
        }
        // A rule that is already running keeps its start date; a new or moved start lies ahead.
        var keepsStart = current != null && current.getValidFrom().equals(details.validFrom());
        if (!keepsStart && details.validFrom().isBefore(LocalDate.now(clock.withZone(DEFAULT_ZONE)))) {
            throw new AvailabilityErrors.InPast();
        }
    }

    private AvailabilitySlot changeableSlot(UUID ownerId, UUID slotId) {
        var slot = slots.findByIdAndOwnerId(slotId, ownerId).orElseThrow(AvailabilityErrors.SlotNotFound::new);
        if (slot.isBooked()) {
            throw new AvailabilityErrors.SlotBooked();
        }
        if (!slot.getStartsAt().isAfter(now())) {
            throw new AvailabilityErrors.InPast();
        }
        return slot;
    }

    private Occurrence changeableDate(AvailabilityRule rule, LocalDate date) {
        if (!rule.fallsOn(date)) {
            throw new AvailabilityErrors.NotARuleDate();
        }
        var occurrence = rule.occurrenceOn(date);
        if (!occurrence.startsAt().isAfter(now())) {
            throw new AvailabilityErrors.InPast();
        }
        return occurrence;
    }

    private AvailabilityRule rule(UUID ownerId, UUID ruleId) {
        return rules.findByIdAndOwnerId(ruleId, ownerId).orElseThrow(AvailabilityErrors.RuleNotFound::new);
    }

    private void checkRange(Instant from, Instant to) {
        if (!from.isBefore(to) || Duration.between(from, to).compareTo(Duration.ofDays(MAX_RANGE_DAYS)) > 0) {
            throw new AvailabilityErrors.RangeInvalid(MAX_RANGE_DAYS);
        }
    }

    private void requireProfile(UUID ownerId) {
        if (!artistProfiles.exists(ownerId)) {
            throw new AvailabilityErrors.ProfileRequired();
        }
    }

    /** One writer per artist at a time, so two saves cannot both pass the overlap check. */
    private void lock(UUID ownerId) {
        jdbc.queryForObject("SELECT 1 FROM pg_advisory_xact_lock(?)", Integer.class,
                ownerId.getMostSignificantBits() ^ ownerId.getLeastSignificantBits());
    }

    private Instant now() {
        return clock.instant();
    }
}
