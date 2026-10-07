package pl.spotonslot.venue.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import pl.spotonslot.venue.domain.VenueInvitation;

public interface VenueInvitationRepository extends JpaRepository<VenueInvitation, UUID> {

    Optional<VenueInvitation> findByTokenHash(String tokenHash);

    Optional<VenueInvitation> findByVenueIdAndEmail(UUID venueId, String email);

    Optional<VenueInvitation> findByIdAndVenueId(UUID id, UUID venueId);

    List<VenueInvitation> findByVenueIdOrderByCreatedAtAsc(UUID venueId);

    List<VenueInvitation> findByInvitedByOrderByCreatedAtAsc(UUID invitedBy);

    long deleteByInvitedBy(UUID invitedBy);
}
