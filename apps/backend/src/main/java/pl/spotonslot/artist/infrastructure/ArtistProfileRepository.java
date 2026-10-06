package pl.spotonslot.artist.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.artist.domain.ArtistProfile;

public interface ArtistProfileRepository extends JpaRepository<ArtistProfile, UUID> {

    Optional<ArtistProfile> findByOwnerId(UUID ownerId);

    Optional<ArtistProfile> findBySlug(String slug);

    boolean existsBySlug(String slug);

    boolean existsByOwnerId(UUID ownerId);

    @Query("SELECT DISTINCT p FROM ArtistProfile p LEFT JOIN p.photoMediaIds photo"
            + " WHERE p.avatarMediaId = :mediaId OR photo = :mediaId")
    List<ArtistProfile> findUsingMedia(@Param("mediaId") UUID mediaId);
}
