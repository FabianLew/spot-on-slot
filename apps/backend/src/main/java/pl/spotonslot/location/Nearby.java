package pl.spotonslot.location;

import java.util.UUID;

/** A subject found by {@link Locations#findWithin}, with its distance from the search point. */
public record Nearby(UUID subjectId, double distanceMeters) {
}
