package pl.spotonslot.listing.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.BatchSize;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.shared.persistence.BaseEntity;

/** An announcement of an artist's free time or of a venue looking for an artist. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "listing")
public class Listing extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, updatable = false, length = 24)
    private ListingKind kind;

    @Getter(AccessLevel.NONE)
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ListingStatus status;

    /** The artist, or the team member who posted for a venue. */
    @Column(name = "author_id", nullable = false, updatable = false)
    private UUID authorId;

    @Column(name = "artist_id", updatable = false)
    private UUID artistId;

    @Column(name = "venue_id", updatable = false)
    private UUID venueId;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false)
    private Instant endsAt;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "price_from")
    private Long priceFrom;

    @Column(name = "price_to")
    private Long priceTo;

    @Column(name = "travel_radius_km")
    private Integer travelRadiusKm;

    @Column(name = "city", length = 120)
    private String city;

    @Column(name = "latitude", nullable = false, updatable = false)
    private double latitude;

    @Column(name = "longitude", nullable = false, updatable = false)
    private double longitude;

    @Column(name = "closed_at")
    private Instant closedAt;

    /** The booking that filled the listing. */
    @Column(name = "booking_id")
    private UUID bookingId;

    @BatchSize(size = 100)
    @ElementCollection
    @CollectionTable(name = "listing_genre", joinColumns = @JoinColumn(name = "listing_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "genre", nullable = false, length = 32)
    private Set<Genre> genres = EnumSet.noneOf(Genre.class);

    public static Listing artistAvailable(UUID artistId, String city, GeoPoint point, ListingDetails details) {
        var listing = create(ListingKind.ARTIST_AVAILABLE, artistId, city, point, details);
        listing.artistId = artistId;
        return listing;
    }

    public static Listing venueSeeking(UUID venueId, UUID authorId, String city, GeoPoint point,
            ListingDetails details) {
        var listing = create(ListingKind.VENUE_SEEKING, authorId, city, point, details);
        listing.venueId = venueId;
        listing.travelRadiusKm = null;
        return listing;
    }

    private static Listing create(ListingKind kind, UUID authorId, String city, GeoPoint point,
            ListingDetails details) {
        var listing = new Listing();
        listing.kind = kind;
        listing.status = ListingStatus.ACTIVE;
        listing.authorId = authorId;
        listing.city = city;
        listing.latitude = point.latitude();
        listing.longitude = point.longitude();
        listing.update(details);
        return listing;
    }

    public void update(ListingDetails details) {
        this.startsAt = details.startsAt();
        this.endsAt = details.endsAt();
        this.description = details.description();
        this.priceFrom = details.priceFrom();
        this.priceTo = details.priceTo();
        this.travelRadiusKm = kind == ListingKind.ARTIST_AVAILABLE ? details.travelRadiusKm() : null;
        this.genres.clear();
        this.genres.addAll(details.genres());
    }

    /** The status as of {@code now}: an active listing whose time has started counts as expired. */
    public ListingStatus statusAt(Instant now) {
        return status == ListingStatus.ACTIVE && !startsAt.isAfter(now) ? ListingStatus.EXPIRED : status;
    }

    public boolean isActiveAt(Instant now) {
        return statusAt(now) == ListingStatus.ACTIVE;
    }

    public void close(Instant now) {
        end(ListingStatus.CLOSED, now);
    }

    public void expire(Instant now) {
        end(ListingStatus.EXPIRED, now);
    }

    public void fill(UUID bookingId, Instant now) {
        this.bookingId = bookingId;
        end(ListingStatus.FILLED, now);
    }

    private void end(ListingStatus status, Instant now) {
        this.status = status;
        this.closedAt = now;
    }

    public GeoPoint point() {
        return new GeoPoint(latitude, longitude);
    }
}
