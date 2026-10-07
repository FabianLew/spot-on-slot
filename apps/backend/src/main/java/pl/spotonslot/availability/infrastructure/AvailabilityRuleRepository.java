package pl.spotonslot.availability.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.availability.domain.AvailabilityRule;

public interface AvailabilityRuleRepository extends JpaRepository<AvailabilityRule, UUID> {

    @EntityGraph(attributePaths = {"days", "skippedDates"})
    List<AvailabilityRule> findByOwnerIdInOrderByCreatedAt(Collection<UUID> owners);

    @EntityGraph(attributePaths = {"days", "skippedDates"})
    Optional<AvailabilityRule> findByIdAndOwnerId(UUID id, UUID ownerId);

    long countByOwnerId(UUID ownerId);

    /** Days and skipped dates go with the rules (foreign keys cascade). */
    @Modifying
    @Query("DELETE FROM AvailabilityRule r WHERE r.ownerId = :ownerId")
    int deleteAllOf(@Param("ownerId") UUID ownerId);
}
