package pl.spotonslot.media.infrastructure;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import pl.spotonslot.media.domain.Media;

public interface MediaRepository extends JpaRepository<Media, UUID> {

    long countByOwnerId(UUID ownerId);

    List<Media> findByOwnerIdOrderByCreatedAtAsc(UUID ownerId);
}
