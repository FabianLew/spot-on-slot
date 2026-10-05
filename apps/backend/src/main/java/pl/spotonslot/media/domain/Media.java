package pl.spotonslot.media.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;

/** A processed image, stored only as its WebP variants. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "media")
public class Media extends BaseEntity {

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(name = "width", nullable = false, updatable = false)
    private int width;

    @Column(name = "height", nullable = false, updatable = false)
    private int height;

    @Column(name = "small_key", nullable = false, length = 200, updatable = false)
    private String smallKey;

    @Column(name = "medium_key", nullable = false, length = 200, updatable = false)
    private String mediumKey;

    @Column(name = "large_key", nullable = false, length = 200, updatable = false)
    private String largeKey;

    /** {@code width}/{@code height} are those of the large variant, i.e. what clients can display at most. */
    public static Media create(UUID ownerId, int width, int height) {
        var media = new Media();
        media.ownerId = ownerId;
        media.width = width;
        media.height = height;
        media.smallKey = media.keyFor(Variant.SMALL);
        media.mediumKey = media.keyFor(Variant.MEDIUM);
        media.largeKey = media.keyFor(Variant.LARGE);
        return media;
    }

    public String keyFor(Variant variant) {
        return "media/" + getId() + "/" + variant.name().toLowerCase() + ".webp";
    }

    public List<String> keys() {
        return List.of(smallKey, mediumKey, largeKey);
    }

    public boolean isOwnedBy(UUID userId) {
        return ownerId.equals(userId);
    }
}
