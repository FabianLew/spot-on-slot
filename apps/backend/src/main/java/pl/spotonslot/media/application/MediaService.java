package pl.spotonslot.media.application;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.media.MediaProperties;
import pl.spotonslot.media.domain.ImageType;
import pl.spotonslot.media.domain.Media;
import pl.spotonslot.media.domain.MediaErrors;
import pl.spotonslot.media.domain.MediaUpload;
import pl.spotonslot.media.domain.Variant;
import pl.spotonslot.media.infrastructure.MediaRepository;
import pl.spotonslot.media.infrastructure.MediaUploadRepository;
import pl.spotonslot.media.infrastructure.ObjectStorage;

/**
 * Upload flow: {@link #startUpload} hands out a presigned PUT link, the browser sends the file straight to
 * storage, {@link #complete} turns it into WebP variants and deletes the original.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MediaService {

    private static final String WEBP = "image/webp";

    private final MediaUploadRepository uploads;
    private final MediaRepository media;
    private final ObjectStorage storage;
    private final ImageProcessor processor;
    private final MediaProperties properties;
    private final TransactionTemplate transaction;
    private final Clock clock;

    public record StartedUpload(UUID uploadId, ObjectStorage.PresignedPut put, Instant expiresAt) {
    }

    @Transactional
    public StartedUpload startUpload(UUID ownerId, String contentType, long size) {
        var type = ImageType.fromContentType(contentType).orElseThrow(MediaErrors.UnsupportedType::new);
        if (size > properties.maxSize().toBytes()) {
            throw new MediaErrors.TooLarge(properties.maxSize().toMegabytes());
        }
        // Pending uploads count too, otherwise many parallel uploads could pass the limit.
        if (media.countByOwnerId(ownerId) + uploads.countByOwnerId(ownerId) >= properties.quota()) {
            throw new MediaErrors.QuotaExceeded(properties.quota());
        }
        var expiresAt = clock.instant().plus(properties.uploadTtl());
        var upload = uploads.save(MediaUpload.start(ownerId, type, size, expiresAt));
        var put = storage.presignPut(upload.getObjectKey(), type.contentType(), size, properties.uploadTtl());
        return new StartedUpload(upload.getId(), put, expiresAt);
    }

    /**
     * Processing runs outside a transaction (it reads and writes storage); only the final swap of the upload for
     * the image is transactional. A file that is not a valid image ends the upload, so the client starts over.
     */
    public Media complete(UUID ownerId, UUID uploadId) {
        var upload = uploads.findById(uploadId)
                .filter(candidate -> candidate.isOwnedBy(ownerId))
                .orElseThrow(MediaErrors.UploadNotFound::new);
        var stored = storage.size(upload.getObjectKey());
        if (stored.isEmpty() || stored.getAsLong() != upload.getSizeBytes()) {
            throw new MediaErrors.FileMissing();
        }
        var type = ImageType.fromContentType(upload.getContentType()).orElseThrow(MediaErrors.UnsupportedType::new);
        ImageProcessor.Result result;
        try {
            result = processor.process(storage.read(upload.getObjectKey()), type);
        } catch (MediaErrors.UnsupportedType | MediaErrors.InvalidImage e) {
            discard(upload);
            throw e;
        }
        var image = Media.create(ownerId, result.width(), result.height());
        for (var variant : Variant.values()) {
            storage.putImmutable(image.keyFor(variant), result.variant(variant), WEBP);
        }
        transaction.executeWithoutResult(status -> {
            media.save(image);
            uploads.deleteById(upload.getId());
        });
        storage.deleteQuietly(upload.getObjectKey());
        return image;
    }

    @Transactional(readOnly = true)
    public Media get(UUID id) {
        return media.findById(id).orElseThrow(MediaErrors.NotFound::new);
    }

    /** Only the owner can delete; for anyone else the image does not exist. */
    public void delete(UUID ownerId, UUID id) {
        var image = media.findById(id)
                .filter(candidate -> candidate.isOwnedBy(ownerId))
                .orElseThrow(MediaErrors.NotFound::new);
        media.delete(image);
        image.keys().forEach(storage::deleteQuietly);
    }

    /** Uploads never completed within {@code pending-retention}: the record and whatever reached storage. */
    public int deleteStaleUploads(Instant now) {
        var stale = uploads.findByCreatedAtBefore(now.minus(properties.pendingRetention()));
        stale.forEach(this::discard);
        return stale.size();
    }

    public String url(Media image, Variant variant) {
        return storage.publicUrl(image.keyFor(variant));
    }

    private void discard(MediaUpload upload) {
        uploads.deleteById(upload.getId());
        storage.deleteQuietly(upload.getObjectKey());
    }
}
