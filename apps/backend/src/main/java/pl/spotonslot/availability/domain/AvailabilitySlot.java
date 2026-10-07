package pl.spotonslot.availability.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;

/** A single stretch of an artist's time, free or taken by a booking. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "availability_slot")
public class AvailabilitySlot extends BaseEntity {

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false)
    private Instant endsAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private SlotStatus status;

    @Column(name = "note", length = 200)
    private String note;

    @Column(name = "booking_id")
    private UUID bookingId;

    public static AvailabilitySlot free(UUID ownerId, Instant startsAt, Instant endsAt, String note) {
        var slot = new AvailabilitySlot();
        slot.ownerId = ownerId;
        slot.status = SlotStatus.FREE;
        slot.change(startsAt, endsAt, note);
        return slot;
    }

    /** Time a booking took straight away (a booked date of a weekly rule). */
    public static AvailabilitySlot booked(UUID ownerId, Instant startsAt, Instant endsAt, String note, UUID bookingId) {
        var slot = free(ownerId, startsAt, endsAt, note);
        slot.occupy(bookingId);
        return slot;
    }

    public void change(Instant startsAt, Instant endsAt, String note) {
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.note = note;
    }

    public void occupy(UUID bookingId) {
        this.status = SlotStatus.BOOKED;
        this.bookingId = bookingId;
    }

    public void release() {
        this.status = SlotStatus.FREE;
        this.bookingId = null;
    }

    public boolean isBooked() {
        return status == SlotStatus.BOOKED;
    }

    public Occurrence toOccurrence() {
        return new Occurrence(startsAt, endsAt, status, note, Occurrence.Source.SLOT, getId(), null, null, bookingId);
    }
}
