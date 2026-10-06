package pl.spotonslot.venue.application;

import pl.spotonslot.venue.VenueRole;
import pl.spotonslot.venue.domain.Venue;

/** A venue together with the caller's role in its team. */
public record ManagedVenue(Venue venue, VenueRole role) {
}
