package pl.spotonslot.venue;

import java.util.UUID;

/** A venue a person manages and their role in it. */
public record VenueMembership(UUID venueId, VenueRole role) {
}
