package pl.spotonslot.artist.domain;

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

/** An artist's profile: a draft until published, then public under {@code /a/{slug}}. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "artist_profile")
public class ArtistProfile extends BaseEntity {

    public static final int MAX_GENRES = 5;
    public static final int MAX_TAGS = 10;
    public static final int MAX_PHOTOS = 12;
    public static final int DEFAULT_TRAVEL_RADIUS_KM = 50;

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(name = "slug", nullable = false, length = 40)
    private String slug;

    @Column(name = "stage_name", nullable = false, length = 60)
    private String stageName;

    @Column(name = "first_name", length = 60)
    private String firstName;

    @Column(name = "last_name", length = 80)
    private String lastName;

    @Column(name = "bio", length = 2000)
    private String bio;

    /** Grosze. */
    @Column(name = "rate_from")
    private Long rateFrom;

    /** Grosze. */
    @Column(name = "rate_to")
    private Long rateTo;

    @Column(name = "travel_radius_km", nullable = false)
    private int travelRadiusKm;

    @Getter(AccessLevel.NONE)
    @Embedded
    private Skills skills;

    @Column(name = "avatar_media_id")
    private UUID avatarMediaId;

    @Column(name = "published_at")
    private Instant publishedAt;

    @ElementCollection
    @CollectionTable(name = "artist_genre", joinColumns = @JoinColumn(name = "profile_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "genre", nullable = false, length = 32)
    private Set<Genre> genres = EnumSet.noneOf(Genre.class);

    @ElementCollection
    @CollectionTable(name = "artist_tag", joinColumns = @JoinColumn(name = "profile_id"))
    @OrderColumn(name = "position")
    @Column(name = "tag", nullable = false, length = 30)
    private List<String> tags = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "artist_link", joinColumns = @JoinColumn(name = "profile_id"))
    @MapKeyEnumerated(EnumType.STRING)
    @MapKeyColumn(name = "kind", length = 16)
    @Column(name = "url", nullable = false, length = 300)
    private Map<LinkKind, String> links = new EnumMap<>(LinkKind.class);

    @ElementCollection
    @CollectionTable(name = "artist_photo", joinColumns = @JoinColumn(name = "profile_id"))
    @OrderColumn(name = "position")
    @Column(name = "media_id", nullable = false)
    private List<UUID> photoMediaIds = new ArrayList<>();

    public static ArtistProfile create(UUID ownerId, String slug) {
        var profile = new ArtistProfile();
        profile.ownerId = ownerId;
        profile.slug = slug;
        profile.travelRadiusKm = DEFAULT_TRAVEL_RADIUS_KM;
        profile.skills = Skills.NONE;
        return profile;
    }

    /** Replaces everything the artist edits; the slug and publication have their own methods. */
    public void update(ArtistDetails details) {
        this.stageName = details.stageName();
        this.firstName = details.firstName();
        this.lastName = details.lastName();
        this.bio = details.bio();
        this.rateFrom = details.rateFrom();
        this.rateTo = details.rateTo();
        this.travelRadiusKm = details.travelRadiusKm();
        this.skills = details.skills();
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

    /** Drops a deleted image from the avatar and the gallery. */
    public boolean forgetMedia(UUID mediaId) {
        var changed = photoMediaIds.removeIf(mediaId::equals);
        if (mediaId.equals(avatarMediaId)) {
            avatarMediaId = null;
            changed = true;
        }
        return changed;
    }

    public Optional<UUID> avatar() {
        return Optional.ofNullable(avatarMediaId);
    }

    public Skills skills() {
        // Hibernate leaves an embeddable null when all its columns are null.
        return skills == null ? Skills.NONE : skills;
    }

    private static <T> void replace(Collection<T> target, Collection<T> values) {
        target.clear();
        target.addAll(values);
    }
}
