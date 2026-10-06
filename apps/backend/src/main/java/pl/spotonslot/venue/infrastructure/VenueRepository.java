package pl.spotonslot.venue.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.venue.domain.Venue;

public interface VenueRepository extends JpaRepository<Venue, UUID> {

    Optional<Venue> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Venue> findByIdIn(Collection<UUID> ids);

    @Query("SELECT DISTINCT v FROM Venue v LEFT JOIN v.photoMediaIds photo"
            + " WHERE v.avatarMediaId = :mediaId OR photo = :mediaId")
    List<Venue> findUsingMedia(@Param("mediaId") UUID mediaId);
}
