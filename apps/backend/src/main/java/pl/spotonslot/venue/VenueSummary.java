package pl.spotonslot.venue;

import java.util.UUID;
import pl.spotonslot.location.GeoPoint;

/** A published venue as other modules (search, listings, booking) see it; the point is exact. */
public record VenueSummary(UUID id, String slug, String name, String city, GeoPoint point) {
}
