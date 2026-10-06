package pl.spotonslot.media;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.media.application.MediaService;
import pl.spotonslot.media.domain.Media;
import pl.spotonslot.media.domain.Variant;
import pl.spotonslot.media.infrastructure.MediaRepository;

/** The module's facade for other modules: look up stored images and their public URLs. */
@Service
@RequiredArgsConstructor
public class MediaLibrary {

    private final MediaRepository repository;
    private final MediaService mediaService;

    @Transactional(readOnly = true)
    public Optional<MediaImage> find(UUID id) {
        return repository.findById(id).map(this::toImage);
    }

    /** The given images in the given order, skipping ids that do not exist. */
    @Transactional(readOnly = true)
    public List<MediaImage> findAll(Collection<UUID> ids) {
        var found = repository.findAllById(ids);
        return ids.stream()
                .flatMap(id -> found.stream().filter(image -> image.getId().equals(id)).findFirst().stream())
                .map(this::toImage)
                .toList();
    }

    /** True when every id names an existing image of {@code ownerId}. */
    @Transactional(readOnly = true)
    public boolean ownsAll(UUID ownerId, Collection<UUID> ids) {
        var distinct = ids.stream().distinct().toList();
        return repository.findAllById(distinct).stream().filter(image -> image.isOwnedBy(ownerId)).count()
                == distinct.size();
    }

    private MediaImage toImage(Media image) {
        return new MediaImage(image.getId(), image.getOwnerId(), image.getWidth(), image.getHeight(),
                mediaService.url(image, Variant.SMALL), mediaService.url(image, Variant.MEDIUM),
                mediaService.url(image, Variant.LARGE));
    }
}
