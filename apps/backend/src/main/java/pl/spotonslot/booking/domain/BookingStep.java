package pl.spotonslot.booking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.booking.BookingParty;
import pl.spotonslot.shared.persistence.BaseEntity;

/** One entry of a booking's history, with the terms as they stood at that step. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "booking_step")
public class BookingStep extends BaseEntity {

    @Getter(AccessLevel.NONE)
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false, updatable = false)
    private Booking booking;

    @Column(name = "seq", nullable = false, updatable = false)
    private int seq;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, updatable = false, length = 16)
    private BookingStepType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "party", nullable = false, updatable = false, length = 8)
    private BookingParty party;

    /** The person who acted; null for the system. */
    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant at;

    @Column(name = "starts_at", nullable = false, updatable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false, updatable = false)
    private Instant endsAt;

    @Column(name = "amount", nullable = false, updatable = false)
    private long amount;

    @Column(name = "message", updatable = false, length = 1000)
    private String message;

    BookingStep(Booking booking, int seq, BookingStepType type, BookingParty party, UUID actorId, Instant at,
            BookingTerms terms) {
        this.booking = booking;
        this.seq = seq;
        this.type = type;
        this.party = party;
        this.actorId = actorId;
        this.at = at;
        this.startsAt = terms.startsAt();
        this.endsAt = terms.endsAt();
        this.amount = terms.amount();
        this.message = terms.message();
    }
}
