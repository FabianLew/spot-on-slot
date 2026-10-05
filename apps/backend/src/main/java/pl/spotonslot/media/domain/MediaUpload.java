package pl.spotonslot.media.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;

/** A presigned upload slot: the browser PUTs the file to {@code objectKey}, then asks to complete it. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "media_upload")
public class MediaUpload extends BaseEntity {

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(name = "object_key", nullable = false, length = 200, updatable = false)
    private String objectKey;

    @Column(name = "content_type", nullable = false, length = 32, updatable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    public static MediaUpload start(UUID ownerId, ImageType type, long sizeBytes, Instant expiresAt) {
        var upload = new MediaUpload();
        upload.ownerId = ownerId;
        upload.objectKey = "uploads/" + upload.getId();
        upload.contentType = type.contentType();
        upload.sizeBytes = sizeBytes;
        upload.expiresAt = expiresAt;
        return upload;
    }

    public boolean isOwnedBy(UUID userId) {
        return ownerId.equals(userId);
    }
}
