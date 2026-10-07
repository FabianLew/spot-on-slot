package pl.spotonslot.media.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import pl.spotonslot.media.domain.MediaUpload;

public interface MediaUploadRepository extends JpaRepository<MediaUpload, UUID> {

    long countByOwnerId(UUID ownerId);

    List<MediaUpload> findByOwnerId(UUID ownerId);

    List<MediaUpload> findByCreatedAtBefore(Instant cutoff);
}
