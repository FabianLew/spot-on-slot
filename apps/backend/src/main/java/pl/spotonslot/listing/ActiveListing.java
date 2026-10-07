package pl.spotonslot.listing;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.location.GeoPoint;

/**
 * An active listing as other modules (search, booking, notifications) see it; exactly one of {@code artistId} and
 * {@code venueId}. {@code travelRadiusKm} is set for "I'm free" only.
 */
public record ActiveListing(UUID id, ListingKind kind, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        Set<Genre> genres, Long priceFrom, Long priceTo, Integer travelRadiusKm, String city, GeoPoint point) {
}
