package pl.spotonslot.listing;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.location.GeoPoint;

/** A new active listing (for notifications in B12); exactly one of {@code artistId} and {@code venueId} is set. */
public record ListingPublished(UUID listingId, ListingKind kind, UUID artistId, UUID venueId, Instant startsAt,
        Instant endsAt, Set<Genre> genres, GeoPoint point) {
}
