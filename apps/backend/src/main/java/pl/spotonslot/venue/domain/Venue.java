package pl.spotonslot.venue.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.MapKeyEnumerated;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.shared.persistence.BaseEntity;
import pl.spotonslot.venue.VenueType;

/** A club, bar or hall with its team: a draft until published, then public under {@code /v/{slug}}. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "venue")
public class Venue extends BaseEntity {

    /** Venue teams one person can be in, as owner or manager. */
    public static final int MAX_PER_USER = 10;
    public static final int MAX_GENRES = 5;
    public static final int MAX_TAGS = 10;
    public static final int MAX_PHOTOS = 12;

    @Column(name = "slug", nullable = false, length = 40)
    private String slug;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 16)
    private VenueType type;

    @Column(name = "description", length = 2000)
    private String description;

    @Column(name = "capacity")
    private Integer capacity;

    @Getter(AccessLevel.NONE)
    @Embedded
    private Address address;

    @Column(name = "avatar_media_id")
    private UUID avatarMediaId;

    @Column(name = "published_at")
    private Instant publishedAt;

    @ElementCollection
    @CollectionTable(name = "venue_genre", joinColumns = @JoinColumn(name = "venue_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "genre", nullable = false, length = 32)
    private Set<Genre> genres = EnumSet.noneOf(Genre.class);

    @ElementCollection
    @CollectionTable(name = "venue_tag", joinColumns = @JoinColumn(name = "venue_id"))
    @OrderColumn(name = "position")
    @Column(name = "tag", nullable = false, length = 30)
    private List<String> tags = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "venue_link", joinColumns = @JoinColumn(name = "venue_id"))
    @MapKeyEnumerated(EnumType.STRING)
    @MapKeyColumn(name = "kind", length = 16)
    @Column(name = "url", nullable = false, length = 300)
    private Map<VenueLinkKind, String> links = new EnumMap<>(VenueLinkKind.class);

    @ElementCollection
    @CollectionTable(name = "venue_photo", joinColumns = @JoinColumn(name = "venue_id"))
    @OrderColumn(name = "position")
    @Column(name = "media_id", nullable = false)
    private List<UUID> photoMediaIds = new ArrayList<>();

    public static Venue create(String slug, VenueDetails details) {
        var venue = new Venue();
        venue.slug = slug;
        venue.update(details);
        return venue;
    }

    /** Replaces everything the team edits; the slug and publication have their own methods. */
    public void update(VenueDetails details) {
        this.name = details.name();
        this.type = details.type();
        this.description = details.description();
        this.capacity = details.capacity();
        this.address = details.address();
        this.avatarMediaId = details.avatarMediaId();
        replace(genres, details.genres());
        replace(tags, details.tags());
        links.clear();
        links.putAll(details.links());
        replace(photoMediaIds, details.photoMediaIds());
    }

    public void changeSlug(String slug) {
        this.slug = slug;
    }

    public Optional<Address> address() {
        // Hibernate leaves an embeddable null when all its columns are null.
        return Optional.ofNullable(address);
    }

    public Optional<UUID> avatar() {
        return Optional.ofNullable(avatarMediaId);
    }

    /** Images the venue shows: the main photo first, then the gallery. */
    public List<UUID> mediaIds() {
        var ids = new ArrayList<UUID>();
        avatar().ifPresent(ids::add);
        photoMediaIds.stream().filter(id -> !ids.contains(id)).forEach(ids::add);
        return ids;
    }

    public boolean isPublished() {
        return publishedAt != null;
    }

    /** Keeps the first publication time when published again. */
    public void publish(Instant now) {
        if (publishedAt == null) {
            publishedAt = now;
        }
    }

    public void unpublish() {
        publishedAt = null;
    }

    /** Drops a deleted image from the main photo and the gallery. */
    public boolean forgetMedia(UUID mediaId) {
        var changed = photoMediaIds.removeIf(mediaId::equals);
        if (mediaId.equals(avatarMediaId)) {
            avatarMediaId = null;
            changed = true;
        }
        return changed;
    }

    private static <T> void replace(Collection<T> target, Collection<T> values) {
        target.clear();
        target.addAll(values);
    }
}
