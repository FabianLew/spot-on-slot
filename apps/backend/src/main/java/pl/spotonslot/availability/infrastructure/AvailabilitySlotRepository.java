package pl.spotonslot.availability.infrastructure;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.availability.domain.AvailabilitySlot;

public interface AvailabilitySlotRepository extends JpaRepository<AvailabilitySlot, UUID> {

    /** Slots of these owners overlapping {@code [from, to)}, in order. */
    @Query("SELECT s FROM AvailabilitySlot s WHERE s.ownerId IN :owners AND s.startsAt < :to AND s.endsAt > :from"
            + " ORDER BY s.startsAt")
    List<AvailabilitySlot> findOverlapping(@Param("owners") Collection<UUID> owners, @Param("from") Instant from,
            @Param("to") Instant to);

    Optional<AvailabilitySlot> findByIdAndOwnerId(UUID id, UUID ownerId);

    Optional<AvailabilitySlot> findByBookingId(UUID bookingId);

    long countByOwnerIdAndStartsAtAfter(UUID ownerId, Instant after);

    List<AvailabilitySlot> findByOwnerIdOrderByStartsAt(UUID ownerId);

    @Modifying
    @Query("DELETE FROM AvailabilitySlot s WHERE s.ownerId = :ownerId")
    int deleteAllOf(@Param("ownerId") UUID ownerId);
}
