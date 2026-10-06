package pl.spotonslot.listing;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.location.GeoPoint;

/**
 * An active listing as search shows it; exactly one of {@code artistId} and {@code venueId}. The point is the one
 * copied on posting (artists: approximated, venues: exact).
 */
public record ListingCard(UUID id, ListingKind kind, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        Set<Genre> genres, String description, Long priceFrom, Long priceTo, Integer travelRadiusKm, String city,
        GeoPoint point) {
}
