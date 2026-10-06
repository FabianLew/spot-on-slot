package pl.spotonslot.location;

import java.util.UUID;

/**
 * A subject found by {@link Locations#findWithin}: its stored point (for people, approximated), town and distance from
 * the search point.
 */
public record Nearby(UUID subjectId, GeoPoint point, String city, double distanceMeters) {
}
