package pl.spotonslot.notification.domain;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.listing.ListingKind;

/**
 * What a {@code NEARBY_LISTING} notification shows, frozen when it was made.
 *
 * @param authorName the venue's name ("Szukam artysty") or the artist's stage name ("Jestem wolny")
 * @param distanceKm whole kilometres between the listing and the recipient (their venue), at least 1
 * @param venueName the recipient's own venue the distance is measured from; venue teams only
 * @param free whether the artist has free time in their calendar then; artists only
 */
public record NearbyListingAlert(UUID listingId, ListingKind kind, String authorName, String authorSlug, String city,
        Instant startsAt, Instant endsAt, List<Genre> genres, Long priceFrom, Long priceTo, int distanceKm,
        String venueName, Boolean free) {
}
