package pl.spotonslot.booking.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.BatchSize;
import pl.spotonslot.booking.BookingParty;
import pl.spotonslot.booking.BookingStatus;
import pl.spotonslot.shared.persistence.BaseEntity;

/**
 * A booking between an artist and a venue: the current terms, whose answer it waits for, and its history. Every
 * proposal (the request and each counter-offer) gets a new {@code revision}; acceptance names the one it accepts.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "booking")
public class Booking extends BaseEntity {

    /** How long a proposal waits for an answer before the booking expires. */
    public static final Duration ANSWER_WITHIN = Duration.ofHours(72);

    @Column(name = "artist_id", nullable = false, updatable = false)
    private UUID artistId;

    @Column(name = "venue_id", nullable = false, updatable = false)
    private UUID venueId;

    /** The listing the booking answers, if any. */
    @Column(name = "listing_id", updatable = false)
    private UUID listingId;

    @Enumerated(EnumType.STRING)
    @Column(name = "initiator", nullable = false, updatable = false, length = 8)
    private BookingParty initiator;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Getter(AccessLevel.NONE)
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private BookingStatus status;

    @Getter(AccessLevel.NONE)
    @Enumerated(EnumType.STRING)
    @Column(name = "awaiting", length = 8)
    private BookingParty awaiting;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false)
    private Instant endsAt;

    /** Grosze. */
    @Column(name = "amount", nullable = false)
    private long amount;

    @Column(name = "revision", nullable = false)
    private int revision;

    @Column(name = "respond_by", nullable = false)
    private Instant respondBy;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "artist_stage_name", nullable = false, updatable = false, length = 60)
    private String artistStageName;

    @Column(name = "venue_name", nullable = false, updatable = false, length = 120)
    private String venueName;

    @BatchSize(size = 100)
    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("seq")
    private List<BookingStep> steps = new ArrayList<>();

    public static Booking request(UUID artistId, UUID venueId, UUID listingId, BookingParty initiator, UUID createdBy,
            String artistStageName, String venueName, BookingTerms terms, Instant now) {
        var booking = new Booking();
        booking.artistId = artistId;
        booking.venueId = venueId;
        booking.listingId = listingId;
        booking.initiator = initiator;
        booking.createdBy = createdBy;
        booking.artistStageName = artistStageName;
        booking.venueName = venueName;
        booking.status = BookingStatus.PENDING;
        booking.revision = 0;
        booking.propose(BookingStepType.REQUESTED, initiator, createdBy, terms, now);
        return booking;
    }

    /** The status as of {@code now}; see {@link BookingStatus} for the time-based ones. */
    public BookingStatus statusAt(Instant now) {
        if (status == BookingStatus.PENDING && (!respondBy.isAfter(now) || !startsAt.isAfter(now))) {
            return BookingStatus.EXPIRED;
        }
        if (status == BookingStatus.ACCEPTED && !endsAt.isAfter(now)) {
            return BookingStatus.COMPLETED;
        }
        return status;
    }

    /** Whose answer the booking waits for as of {@code now}, null once it is no longer pending. */
    public BookingParty awaitingAt(Instant now) {
        return statusAt(now) == BookingStatus.PENDING ? awaiting : null;
    }

    /** The side that made the latest proposal. */
    public BookingParty proposer() {
        return awaiting == null ? lastProposal().getParty() : other(awaiting);
    }

    /** When a time-based status took effect: the end of the answer window or of the gig. */
    public Instant timedOutAt() {
        return status == BookingStatus.ACCEPTED ? endsAt : (respondBy.isBefore(startsAt) ? respondBy : startsAt);
    }

    public BookingTerms terms() {
        return new BookingTerms(startsAt, endsAt, amount, lastProposal().getMessage());
    }

    public void counter(BookingParty party, UUID actorId, BookingTerms terms, Instant now) {
        propose(BookingStepType.COUNTERED, party, actorId, terms, now);
    }

    public void accept(BookingParty party, UUID actorId, Instant now) {
        close(BookingStatus.ACCEPTED, BookingStepType.ACCEPTED, party, actorId, null, now);
        this.closedAt = null;
    }

    public void decline(BookingParty party, UUID actorId, String reason, Instant now) {
        close(BookingStatus.DECLINED, BookingStepType.DECLINED, party, actorId, reason, now);
    }

    public void withdraw(BookingParty party, UUID actorId, Instant now) {
        close(BookingStatus.WITHDRAWN, BookingStepType.WITHDRAWN, party, actorId, null, now);
    }

    public void cancel(BookingParty party, UUID actorId, String reason, Instant now) {
        close(BookingStatus.CANCELLED, BookingStepType.CANCELLED, party, actorId, reason, now);
    }

    /** Stores a time-based status ({@code EXPIRED} or {@code COMPLETED}) that reads already showed. */
    public void storeTimedOut(Instant now) {
        var timedOut = statusAt(now);
        var type = timedOut == BookingStatus.EXPIRED ? BookingStepType.EXPIRED : BookingStepType.COMPLETED;
        close(timedOut, type, BookingParty.SYSTEM, null, null, now);
    }

    private void propose(BookingStepType type, BookingParty party, UUID actorId, BookingTerms terms, Instant now) {
        this.startsAt = terms.startsAt();
        this.endsAt = terms.endsAt();
        this.amount = terms.amount();
        this.revision++;
        this.awaiting = other(party);
        this.respondBy = now.plus(ANSWER_WITHIN);
        step(type, party, actorId, terms, now);
    }

    private void close(BookingStatus status, BookingStepType type, BookingParty party, UUID actorId, String message,
            Instant now) {
        this.status = status;
        this.awaiting = null;
        this.closedAt = now;
        step(type, party, actorId, new BookingTerms(startsAt, endsAt, amount, message), now);
    }

    private void step(BookingStepType type, BookingParty party, UUID actorId, BookingTerms terms, Instant now) {
        steps.add(new BookingStep(this, steps.size() + 1, type, party, actorId, now, terms));
    }

    private BookingStep lastProposal() {
        for (var i = steps.size() - 1; i >= 0; i--) {
            var step = steps.get(i);
            if (step.getType() == BookingStepType.REQUESTED || step.getType() == BookingStepType.COUNTERED) {
                return step;
            }
        }
        throw new IllegalStateException("A booking starts with a request");
    }

    private static BookingParty other(BookingParty party) {
        return party == BookingParty.ARTIST ? BookingParty.VENUE : BookingParty.ARTIST;
    }
}
