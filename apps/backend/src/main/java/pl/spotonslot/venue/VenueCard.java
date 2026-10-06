package pl.spotonslot.venue;

import java.util.Set;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.location.GeoPoint;

/** A published venue as search and listings show it, without the team; the point is exact. */
public record VenueCard(UUID id, String slug, String name, VenueType type, String city, Set<Genre> genres,
        Integer capacity, UUID avatarMediaId, GeoPoint point) {
}
