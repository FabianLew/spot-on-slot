package pl.spotonslot.listing;

import java.time.Instant;
import java.util.Set;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.location.GeoPoint;

/**
 * What {@link Listings#findActiveWithin} looks for. Null {@code kind}, {@code from}/{@code to} and {@code budget}, and
 * empty {@code genres}, do not filter. {@code [from, to)} keeps listings overlapping it; {@code budget} (grosze) keeps
 * "looking for an artist" whose top amount reaches it and "I'm free" whose bottom amount stays within it, and always
 * listings without amounts.
 */
public record ListingSearch(GeoPoint center, double radiusKm, ListingKind kind, Instant from, Instant to,
        Set<Genre> genres, Long budget, int limit) {
}
