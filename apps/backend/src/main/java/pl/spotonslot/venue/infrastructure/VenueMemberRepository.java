package pl.spotonslot.venue.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import pl.spotonslot.venue.VenueRole;
import pl.spotonslot.venue.domain.VenueMember;

public interface VenueMemberRepository extends JpaRepository<VenueMember, UUID> {

    Optional<VenueMember> findByVenueIdAndUserId(UUID venueId, UUID userId);

    List<VenueMember> findByVenueIdOrderByCreatedAtAsc(UUID venueId);

    List<VenueMember> findByUserIdOrderByCreatedAtAsc(UUID userId);

    List<VenueMember> findByVenueIdIn(Collection<UUID> venueIds);

    long countByUserId(UUID userId);

    long countByVenueId(UUID venueId);

    long countByVenueIdAndRole(UUID venueId, VenueRole role);
}
