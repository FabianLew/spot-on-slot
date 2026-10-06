package pl.spotonslot.listing;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.location.GeoPoint;

/** An active listing as other modules (search, booking) see it; exactly one of {@code artistId} and {@code venueId}. */
public record ActiveListing(UUID id, ListingKind kind, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
        Set<Genre> genres, Long priceFrom, Long priceTo, GeoPoint point) {
}
